import "server-only";
import { log, sqlstate } from "@/lib/log";

import { sql } from "kysely";
import { db } from "@/db/db";

type RateLimit = { key: string; limit: number; windowSeconds: number };

// One upsert serializes consumption of a fixed window across all replicas.
export async function consumeRateLimit(
  { key, limit, windowSeconds }: RateLimit,
  connection = db,
) {
  const result = await sql<{ count: number }>`
      INSERT INTO "public"."rate_limit" ("key", "count", "windowStart")
      VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
          THEN 1
          ELSE LEAST("rate_limit"."count" + 1, ${limit + 1})
        END,
        "windowStart" = CASE
          WHEN "rate_limit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
          THEN now()
          ELSE "rate_limit"."windowStart"
        END
      RETURNING "count"
    `.execute(connection);

  const count = Number(result.rows[0]?.count ?? 0);

  return { allowed: count <= limit };
}

export async function checkRateLimit({
  failClosed = false,
  ...check
}: RateLimit & { failClosed?: boolean }) {
  try {
    return await consumeRateLimit(check);
  } catch (error) {
    log("rate-limit.unavailable", { sqlstate: sqlstate(error) }, "warn");
    return { allowed: !failClosed };
  }
}
