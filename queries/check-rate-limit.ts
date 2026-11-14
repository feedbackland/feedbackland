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

// Only allowed requests increment these counters. Use the database clock on
// every replica, including when the PostgreSQL session time zone is non-UTC.
export async function consumeAiBudget(
  cap: number,
  n = 1,
  connection = db,
  diagnostic = false,
) {
  if (
    !Number.isInteger(cap) ||
    cap < 1 ||
    cap > 1_000_000 ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > cap
  )
    return null;
  const prefix = diagnostic
    ? "ai:instance:day:diagnostic:"
    : "ai:instance:day:";
  const result = await sql<{ day: string }>`
    with instant as (select clock_timestamp() as at),
    attempt as (insert into rate_limit(key,count,"windowStart")
      select ${prefix}::text || to_char(at at time zone 'UTC','YYYY-MM-DD'), ${n}::integer, at from instant
      on conflict(key) do update set count=rate_limit.count+excluded.count
        where rate_limit.count+excluded.count<=${cap}
      returning "windowStart")
    select to_char("windowStart" at time zone 'UTC','YYYY-MM-DD') as day from attempt`.execute(
    connection,
  );
  return result.rows[0]?.day ?? null;
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
