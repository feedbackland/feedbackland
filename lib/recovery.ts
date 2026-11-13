import "server-only";
import { randomUUID } from "node:crypto";
import { type Kysely, sql } from "kysely";
import { z } from "zod/v4";
import type { DB } from "../db/schema";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { getConfig } from "./config";
import { getAuth } from "./auth/server";
import { getClientIp } from "./client-ip";
import { DomainError } from "./domain-error";
import {
  credentialAccount,
  credentialFingerprint,
  lockCredentialUser,
  revokeResetLinks,
  withCredentialAdapter,
} from "./auth/credentials";
import { matchesOperatorCode, operatorCodeDigest } from "./operator-code";
import { checkRateLimit } from "../queries/check-rate-limit";
import { log, sqlstate } from "./log";

export const recoveryInput = z
  .object({
    code: z.string().max(256),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().trim().min(8).max(128),
  })
  .strict();
const rejected = () =>
  new DomainError(
    "BAD_REQUEST",
    "Recovery could not be completed. Check the code and account details.",
  );
const partial = () =>
  new DomainError(
    "CONFLICT",
    "Recovery did not finish. The password may already have changed. Retry with the same recovery code; administrator access is restored only when recovery completes.",
  );
const adminCount = async (trx: Kysely<DB>) =>
  (
    await trx
      .selectFrom("user")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("role", "=", "admin")
      .executeTakeFirstOrThrow()
  ).count;

export async function completeRecovery(input: unknown, headers: Headers) {
  const configured = getConfig().recoveryCode;
  if (!configured) throw new DomainError("NOT_FOUND", "Not found");
  if (
    !(
      await checkRateLimit({
        key: `recover:ip:${getClientIp(headers)}`,
        limit: 5,
        windowSeconds: 900,
        failClosed: true,
      })
    ).allowed
  )
    throw new DomainError(
      "FORBIDDEN",
      "Too many attempts or recovery is temporarily unavailable. Try again later.",
    );
  const parsed = recoveryInput.safeParse(input);
  if (!parsed.success || !matchesOperatorCode(parsed.data.code, configured))
    throw rejected();
  const data = parsed.data;
  const codeDigest = operatorCodeDigest(configured);
  const owner = randomUUID(),
    operationId = randomUUID();
  const claim = await db
    .transaction()
    .execute(async (trx) => {
      await lock(trx, locks.membership);
      const settings = await trx
        .selectFrom("settings")
        .select("setupCompletedAt")
        .where("id", "=", 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (!settings.setupCompletedAt) throw rejected();
      const user = await trx
        .selectFrom("user")
        .select(["id", "role"])
        .where("email", "=", data.email)
        .forUpdate()
        .executeTakeFirst();
      if (!user || (user.role !== "admin" && (await adminCount(trx)) !== 0))
        throw rejected();
      const account = await credentialAccount(trx, user.id)
        .forUpdate()
        .executeTakeFirst();
      if (!account?.password) throw rejected();
      const existing = await trx
        .selectFrom("recovery_claim")
        .selectAll()
        .select(sql<Date>`clock_timestamp()`.as("now"))
        .where("codeDigest", "=", codeDigest)
        .where("userId", "=", user.id)
        .forUpdate()
        .noWait()
        .executeTakeFirst();
      if (existing?.status === "promoted") {
        if (user.role !== "admin") throw rejected();
        if (
          existing.credentialFingerprint !==
          credentialFingerprint(account.password)
        )
          throw new DomainError(
            "CONFLICT",
            "This recovery code was already used. Configure a fresh code to recover this account again.",
          );
        return { userId: user.id, completed: true, resume: true };
      }
      const resume =
        existing?.status === "reset" &&
        existing.credentialFingerprint ===
          credentialFingerprint(account.password);
      if (existing && existing.expiresAt > existing.now)
        throw new DomainError(
          "CONFLICT",
          "Recovery is in progress. Wait before retrying.",
        );
      await trx
        .insertInto("recovery_claim")
        .values({
          codeDigest,
          userId: user.id,
          owner,
          operationId,
          status: resume ? "reset" : "resetting",
        })
        .onConflict((oc) =>
          oc.columns(["codeDigest", "userId"]).doUpdateSet({
            owner,
            operationId,
            status: resume ? "reset" : "resetting",
            credentialFingerprint: resume
              ? existing.credentialFingerprint
              : null,
            failure: null,
            createdAt: sql`clock_timestamp()`,
            expiresAt: sql`clock_timestamp()+interval '15 minutes'`,
          }),
        )
        .execute();
      return { userId: user.id, completed: false, resume: !!resume };
    })
    .catch((error: unknown) => {
      if (sqlstate(error) === "55P03")
        throw new DomainError(
          "CONFLICT",
          "Recovery is in progress. Wait before retrying.",
        );
      throw error;
    });
  if (claim.completed)
    return { restored: true as const, previousPassword: true };
  let passwordMayHaveChanged = claim.resume;
  try {
    if (!claim.resume) {
      const context = await getAuth().$context;
      const hash = await context.password.hash(data.password);
      await db.transaction().execute(async (trx) => {
        const user = await lockCredentialUser(trx, claim.userId);
        const account = await credentialAccount(trx, claim.userId)
          .forUpdate()
          .executeTakeFirst();
        const current = await trx
          .selectFrom("recovery_claim")
          .select("owner")
          .where("codeDigest", "=", codeDigest)
          .where("userId", "=", claim.userId)
          .where("operationId", "=", operationId)
          .where("owner", "=", owner)
          .where("status", "=", "resetting")
          .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
          .forUpdate()
          .executeTakeFirst();
        if (
          !user ||
          user.email !== data.email ||
          !account?.password ||
          !current ||
          !matchesOperatorCode(data.code, getConfig().recoveryCode)
        )
          throw rejected();
        // Hashing is finished. The claim check, SDK writes and marker commit
        // together on this connection, including after backend loss or retry.
        passwordMayHaveChanged = true;
        await withCredentialAdapter(trx, context, async () => {
          await context.internalAdapter.updatePassword(user.id, hash);
          await context.internalAdapter.deleteUserSessions(user.id);
        });
        await revokeResetLinks(trx, user.id);
        await trx
          .updateTable("recovery_claim")
          .set({
            status: "reset",
            credentialFingerprint: credentialFingerprint(hash),
          })
          .where("codeDigest", "=", codeDigest)
          .where("userId", "=", user.id)
          .execute();
      });
    }
    const restored = await db.transaction().execute(async (trx) => {
      await lock(trx, locks.membership);
      await trx
        .selectFrom("settings")
        .select("id")
        .where("id", "=", 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const user = await lockCredentialUser(trx, claim.userId);
      const account = await credentialAccount(trx, claim.userId)
        .forUpdate()
        .executeTakeFirst();
      const current = await trx
        .selectFrom("recovery_claim")
        .select(["owner", "operationId", "status", "credentialFingerprint"])
        .where("codeDigest", "=", codeDigest)
        .where("userId", "=", claim.userId)
        .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
        .forUpdate()
        .executeTakeFirst();
      if (
        !current ||
        current.owner !== owner ||
        current.operationId !== operationId ||
        current.status !== "reset" ||
        !matchesOperatorCode(data.code, getConfig().recoveryCode)
      )
        return false;
      if (
        !user ||
        user.email !== data.email ||
        !account?.password ||
        current.credentialFingerprint !==
          credentialFingerprint(account.password) ||
        (user.role !== "admin" && (await adminCount(trx)) !== 0)
      ) {
        await trx
          .updateTable("recovery_claim")
          .set({ failure: "account-changed" })
          .where("codeDigest", "=", codeDigest)
          .where("userId", "=", claim.userId)
          .execute();
        return false;
      }
      await trx
        .updateTable("user")
        .set({ role: "admin" })
        .where("id", "=", claim.userId)
        .execute();
      await trx
        .deleteFrom("auth_session")
        .where("userId", "=", claim.userId)
        .execute();
      await revokeResetLinks(trx, user.id);
      await trx
        .updateTable("recovery_claim")
        .set({ status: "promoted", failure: null })
        .where("codeDigest", "=", codeDigest)
        .where("userId", "=", claim.userId)
        .where("owner", "=", owner)
        .where("operationId", "=", operationId)
        .execute();
      return true;
    });
    if (!restored) throw partial();
    log("recovery.completed", {
      target: claim.userId,
      time: new Date().toISOString(),
    });
    return { restored: true as const, previousPassword: claim.resume };
  } catch (error) {
    // The final transaction may have committed despite a lost acknowledgement.
    try {
      const durable = await db
        .selectFrom("recovery_claim")
        .innerJoin("user", "user.id", "recovery_claim.userId")
        .innerJoin("auth_account", "auth_account.userId", "user.id")
        .where("auth_account.providerId", "=", "credential")
        .whereRef("auth_account.accountId", "=", "user.id")
        .select([
          "recovery_claim.status",
          "recovery_claim.credentialFingerprint",
          "auth_account.password",
          "user.role",
        ])
        .where("codeDigest", "=", codeDigest)
        .where("recovery_claim.userId", "=", claim.userId)
        .where("operationId", "=", operationId)
        .executeTakeFirst();
      if (
        durable?.status === "promoted" &&
        durable.role === "admin" &&
        durable.password &&
        durable.credentialFingerprint ===
          credentialFingerprint(durable.password)
      )
        return { restored: true as const, previousPassword: claim.resume };
    } catch {}
    log("recovery.incomplete", { sqlstate: sqlstate(error) }, "warn");
    throw passwordMayHaveChanged ? partial() : rejected();
  }
}
