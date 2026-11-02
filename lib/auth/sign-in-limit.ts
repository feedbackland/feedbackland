import "server-only";
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "../../db/db";
import { log, sqlstate } from "../log";
import type { SignInPermit } from "./options";

const limit = 10;
export async function reserveSignIn(
  email: string,
): Promise<SignInPermit | null> {
  const key = `sign-in:email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`;
  try {
    // count includes completed failures AND admitted requests still in flight.
    // No app-pool connection/transaction is held during password verification.
    const result = await sql<{ windowToken: string }>`
      INSERT INTO rate_limit (key, count, "windowStart")
      VALUES (${key}, 1, statement_timestamp())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit."windowStart" <= statement_timestamp() - interval '15 minutes'
          THEN 1 ELSE rate_limit.count + 1 END,
        "windowStart" = CASE
          WHEN rate_limit."windowStart" <= statement_timestamp() - interval '15 minutes'
          THEN statement_timestamp() ELSE rate_limit."windowStart" END
      WHERE rate_limit."windowStart" <= statement_timestamp() - interval '15 minutes'
        OR rate_limit.count < ${limit}
      RETURNING "windowStart"::text AS "windowToken"
    `.execute(db);
    const windowToken = result.rows[0]?.windowToken;
    if (!windowToken) return null;
    let finished = false;
    return {
      async complete(failed) {
        if (finished) return;
        finished = true;
        if (failed) return;
        try {
          // Preserve microseconds, and fence refunds from an older window.
          // Unfinished/interrupted attempts conservatively occupy their slot
          // until that fixed window expires; they cannot admit extra guesses.
          await sql`
            UPDATE rate_limit SET count = greatest(count - 1, 0)
            WHERE key = ${key} AND "windowStart" = ${windowToken}::timestamptz
          `.execute(db);
        } catch (error) {
          log(
            "auth.email-limit-refund-unavailable",
            { sqlstate: sqlstate(error) },
            "warn",
          );
        }
      },
    };
  } catch (error) {
    // Retain the documented fail-open policy when the limiter is unavailable.
    log("auth.email-limit-unavailable", { sqlstate: sqlstate(error) }, "warn");
    return { complete: async () => {} };
  }
}
