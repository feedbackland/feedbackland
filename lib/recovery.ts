import "server-only";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import { z } from "zod/v4";
import type { DB } from "../db/schema";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { getConfig } from "./config";
import { getAuth } from "./auth/server";
import { getClientIp } from "./client-ip";
import { DomainError } from "./domain-error";
import { captureResetToken } from "./mail";
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

export async function resetRecoveryPassword(
  userId: string,
  email: string,
  password: string,
  headers?: Headers,
) {
  const token = await captureResetToken(userId, () =>
    getAuth().api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      headers,
    }),
  );
  await getAuth().api.resetPassword({
    body: { token, newPassword: password },
    headers,
  });
}
export async function completeRecovery(
  input: unknown,
  headers: Headers,
  dependencies: { resetPassword: typeof resetRecoveryPassword } = {
    resetPassword: resetRecoveryPassword,
  },
) {
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
      const account = await trx
        .selectFrom("auth_account")
        .select("id")
        .where("userId", "=", user.id)
        .where("providerId", "=", "credential")
        .where("password", "is not", null)
        .executeTakeFirst();
      if (!account) throw rejected();
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
        return { userId: user.id, completed: true, resume: true };
      }
      const resume = existing?.status === "reset";
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
      // Hold only this claim row on a separate connection, never membership or
      // settings, during the SDK operation. Even an expired owner paused inside
      // reset cannot overlap a replacement reset. The minimum app pool remains
      // available to Better Auth, including through transaction-mode poolers.
      const pool = new Pool({
        ...getConfig().database(),
        max: 1,
        connectionTimeoutMillis: 5000,
        statement_timeout: 30_000,
        application_name: "feedbackland-recovery",
      });
      pool.on("error", (error) =>
        log("recovery.idle-error", { sqlstate: sqlstate(error) }, "warn"),
      );
      const isolated = new Kysely<DB>({
        dialect: new PostgresDialect({ pool }),
      });
      try {
        await isolated.transaction().execute(async (trx) => {
          const current = await trx
            .selectFrom("recovery_claim")
            .select(["owner", "operationId", "status"])
            .where("codeDigest", "=", codeDigest)
            .where("userId", "=", claim.userId)
            .where("expiresAt", ">", sql<Date>`clock_timestamp()`)
            .forUpdate()
            .executeTakeFirst();
          if (
            !current ||
            current.owner !== owner ||
            current.operationId !== operationId ||
            current.status !== "resetting" ||
            !matchesOperatorCode(data.code, getConfig().recoveryCode)
          )
            throw partial();
          passwordMayHaveChanged = true;
          await dependencies.resetPassword(
            claim.userId,
            data.email,
            data.password,
            headers,
          );
          await trx
            .updateTable("recovery_claim")
            .set({ status: "reset" })
            .where("codeDigest", "=", codeDigest)
            .where("userId", "=", claim.userId)
            .where("owner", "=", owner)
            .where("operationId", "=", operationId)
            .execute();
        });
      } finally {
        await isolated.destroy();
      }
    }
    const restored = await db.transaction().execute(async (trx) => {
      await lock(trx, locks.membership);
      await trx
        .selectFrom("settings")
        .select("id")
        .where("id", "=", 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const user = await trx
        .selectFrom("user")
        .select("role")
        .where("id", "=", claim.userId)
        .forUpdate()
        .executeTakeFirst();
      const current = await trx
        .selectFrom("recovery_claim")
        .select(["owner", "operationId", "status"])
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
      if (!user || (user.role !== "admin" && (await adminCount(trx)) !== 0)) {
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
        .select(["recovery_claim.status", "user.role"])
        .where("codeDigest", "=", codeDigest)
        .where("recovery_claim.userId", "=", claim.userId)
        .where("operationId", "=", operationId)
        .executeTakeFirst();
      if (durable?.status === "promoted" && durable.role === "admin")
        return { restored: true as const, previousPassword: claim.resume };
    } catch {}
    log("recovery.incomplete", { sqlstate: sqlstate(error) }, "warn");
    throw passwordMayHaveChanged ? partial() : rejected();
  }
}
