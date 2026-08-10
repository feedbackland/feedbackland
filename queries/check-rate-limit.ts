"server-only";

import { sql } from "kysely";
import { db } from "@/db/db";

/**
 * Atomic fixed-window rate limit, backed by the `rate_limit` table so the count
 * is shared across serverless instances (an in-memory counter would reset on
 * every cold start). One statement: it inserts the key, or — if the current
 * window has elapsed — resets it, otherwise increments. The row lock makes
 * concurrent callers serialize, so the returned count is exact.
 *
 * Fails open: if the check itself errors (e.g. the table is missing because the
 * migration has not been run yet), the request is allowed rather than blocked.
 */
export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean }> {
  try {
    const result = await sql<{ count: number }>`
      INSERT INTO "public"."rate_limit" ("key", "count", "windowStart")
      VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
          THEN 1
          ELSE "rate_limit"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "rate_limit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
          THEN now()
          ELSE "rate_limit"."windowStart"
        END
      RETURNING "count"
    `.execute(db);

    const count = Number(result.rows[0]?.count ?? 0);

    return { allowed: count <= limit };
  } catch (error) {
    console.error("Rate limit check failed; allowing request", error);
    return { allowed: true };
  }
}
