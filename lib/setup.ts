import "server-only";
import { Pool } from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import { z } from "zod/v4";
import type { DB } from "../db/schema";
import { db } from "../db/db";
import { lock, locks } from "../db/locks";
import { clearSetupCode, verifySetupCode } from "./boot";
import { getConfig } from "./config";
import { getAuth } from "./auth/server";
import { getClientIp } from "./client-ip";
import { checkRateLimit } from "../queries/check-rate-limit";
import { DomainError } from "./domain-error";
import { runtimeState } from "./runtime-state";
import { log, sqlstate } from "./log";

export const setupInput = z
  .object({
    code: z.string().max(256),
    platformTitle: z.string().trim().min(1).max(300),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().trim().min(8).max(128),
  })
  .strict();
const failed = () =>
  new DomainError(
    "BAD_REQUEST",
    "Setup could not be completed. Check the code and account details, then try again.",
  );

export async function completeSetup(input: unknown, headers: Headers) {
  if (
    !(
      await checkRateLimit({
        key: `setup:ip:${getClientIp(headers)}`,
        limit: 5,
        windowSeconds: 900,
        failClosed: true,
      })
    ).allowed
  )
    throw new DomainError(
      "FORBIDDEN",
      "Too many attempts or setup is temporarily unavailable. Try again later.",
    );
  const parsed = setupInput.safeParse(input);
  if (!parsed.success || !(await verifySetupCode(parsed.data.code)))
    throw failed();
  const data = parsed.data;
  // This pool is deliberately separate: the minimum app pool has one ordinary
  // connection and Better Auth needs it while the setup transaction holds locks.
  const pool = new Pool({
    ...getConfig().database(),
    max: 1,
    application_name: "feedbackland-setup",
  });
  pool.on("error", (error) =>
    log("setup.idle-error", { sqlstate: sqlstate(error) }, "warn"),
  );
  const dedicated = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  });
  let createdUser: string | undefined;
  try {
    const result = await dedicated.transaction().execute(async (trx) => {
      await lock(trx, locks.setup);
      await lock(trx, locks.membership);
      const settings = await trx
        .selectFrom("settings")
        .select("setupCompletedAt")
        .where("id", "=", 1)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (settings.setupCompletedAt || !(await verifySetupCode(data.code, trx)))
        throw failed();
      const authHeaders = new Headers(headers);
      authHeaders.delete("authorization");
      authHeaders.delete("cookie");
      authHeaders.delete("x-feedbackland-scope");
      const created = await getAuth().api.signUpEmail({
        body: { name: data.name, email: data.email, password: data.password },
        headers: authHeaders,
      });
      createdUser = created.user.id;
      await trx
        .updateTable("user")
        .set({ role: "admin" })
        .where("id", "=", createdUser)
        .executeTakeFirstOrThrow();
      await trx
        .updateTable("settings")
        .set({
          platformTitle: data.platformTitle,
          setupCompletedAt: sql`clock_timestamp()`,
          revision: sql`revision+1`,
          updatedAt: sql`clock_timestamp()`,
        })
        .where("id", "=", 1)
        .executeTakeFirstOrThrow();
      await clearSetupCode(trx);
      return { userId: createdUser };
    });
    runtimeState().setupComplete = true;
    return result;
  } catch (error) {
    // A lost COMMIT acknowledgement is not proof of rollback. Reacquire the
    // same locks on the app pool, after the dedicated transaction has ended,
    // to reconcile its durable outcome before considering compensation.
    if (createdUser) {
      try {
        const userId = createdUser;
        const committed = await db.transaction().execute(async (trx) => {
          await lock(trx, locks.setup);
          await lock(trx, locks.membership);
          const settings = await trx
            .selectFrom("settings")
            .select("setupCompletedAt")
            .where("id", "=", 1)
            .forUpdate()
            .executeTakeFirstOrThrow();
          const user = await trx
            .selectFrom("user")
            .select("role")
            .where("id", "=", userId)
            .forUpdate()
            .executeTakeFirst();
          if (settings.setupCompletedAt) return user?.role === "admin";
          // Never delete a promoted identity or compensate after another
          // attempt has claimed setup. An unavailable/ambiguous outcome is
          // preserved for reconciliation, rather than destructively guessed.
          if (user?.role === "user")
            await trx
              .deleteFrom("user")
              .where("id", "=", userId)
              .where("role", "=", "user")
              .execute();
          return false;
        });
        if (committed) {
          log("setup.commit-reconciled", { sqlstate: sqlstate(error) }, "warn");
          runtimeState().setupComplete = true;
          return { userId };
        }
      } catch (cleanup) {
        log("setup.cleanup-failed", { sqlstate: sqlstate(cleanup) }, "error");
      }
    }
    if (error instanceof DomainError) throw error;
    log("setup.failed", { sqlstate: sqlstate(error) }, "warn");
    throw failed();
  } finally {
    await dedicated.destroy();
  }
}
