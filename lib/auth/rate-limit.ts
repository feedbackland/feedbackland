import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { BetterAuthOptions } from "better-auth";
import { db } from "../../db/db";

/** SDK rolling-window semantics, with atomic admission and DB-clock deadlines. */
export const authRateLimit: NonNullable<
  NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]
> = {
  async consume(key, { window, max }) {
    const admitted = await sql`
      insert into auth_rate_limit (id,key,count,"lastRequest")
      values (${randomUUID()},${key},1,floor(extract(epoch from clock_timestamp())*1000)::bigint)
      on conflict (key) do update set
        count=case when auth_rate_limit."lastRequest"<=floor(extract(epoch from clock_timestamp())*1000)::bigint-${window * 1000}
          then 1 else auth_rate_limit.count+1 end,
        "lastRequest"=floor(extract(epoch from clock_timestamp())*1000)::bigint
      where auth_rate_limit.count<${max}
         or auth_rate_limit."lastRequest"<=floor(extract(epoch from clock_timestamp())*1000)::bigint-${window * 1000}
      returning id
    `.execute(db);
    if (admitted.rows.length) return { allowed: true, retryAfter: null };
    const deadline = await sql<{ seconds: number }>`
      select greatest(1,ceil(("lastRequest"+${window * 1000}-extract(epoch from clock_timestamp())*1000)/1000))::int as seconds
      from auth_rate_limit where key=${key}
    `.execute(db);
    // A concurrent expiry/prune cannot grant admission without reserving it.
    return {
      allowed: false,
      retryAfter: Math.min(window, deadline.rows[0]?.seconds ?? window),
    };
  },
};
