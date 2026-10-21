import "server-only";
import { sql } from "kysely";
import { db } from "../db/db";
import { locks } from "../db/locks";
import { runtimeState } from "./runtime-state";
import { log, sqlstate } from "./log";
import { sweepHealth } from "./llm/settings-store";

const sweeps = [
  [
    "rate_limit",
    `"windowStart"<now()-case when key like 'ai:instance:day:%' then interval '2 days' else interval '1 hour' end`,
  ],
  ["auth_session", `"expiresAt"<now()`],
  ["auth_verification", `"expiresAt"<now()`],
  [
    "auth_rate_limit",
    `"lastRequest"<extract(epoch from now()-interval '1 hour')*1000`,
  ],
  ["admin_invites", `"expiresAt"<now()-interval '1 day'`],
  [
    "activity_seen",
    `not exists(select 1 from feedback where id="itemId") and not exists(select 1 from comment where id="itemId")`,
  ],
  [
    "user_upvote",
    `not exists(select 1 from feedback where id="contentId") and not exists(select 1 from comment where id="contentId")`,
  ],
  [
    "insight_reports",
    `status<>'running' and id not in (select id from insight_reports where status<>'running' order by "createdAt" desc,id desc limit 50)`,
  ],
  ["moderation_event", `"createdAt"<now()-interval '30 days'`],
  ["llm_usage", `day<(now() at time zone 'UTC')::date-400`],
  ["recovery_claim", `"expiresAt"<now()-interval '24 hours'`],
] as const;
async function deleteBatches(table: string, predicate: string) {
  let count: number;
  do {
    count = await db.transaction().execute(async (trx) => {
      await sql`set local statement_timeout='5s'`.execute(trx);
      const lock = await sql<{
        acquired: boolean;
      }>`select pg_try_advisory_xact_lock(${locks.sweep.toString()}::bigint) as acquired`.execute(
        trx,
      );
      if (!lock.rows[0].acquired) return 0;
      const result = await sql
        .raw(
          `delete from "${table}" where ctid in (select ctid from "${table}" where ${predicate} limit 1000 for update skip locked) returning 1`,
        )
        .execute(trx);
      return result.rows.length;
    });
  } while (count === 1000);
}
export async function sweep(hourly = true) {
  const tasks = [
    ["search_session", `"expiresAt"<now()`],
    ...(hourly ? sweeps : []),
  ] as const;
  for (const [table, predicate] of tasks) {
    try {
      await deleteBatches(table, predicate);
    } catch (error) {
      log(
        "housekeeping.sweep-failed",
        { name: table, sqlstate: sqlstate(error) },
        "warn",
      );
    }
  }
  try {
    await db.transaction().execute(async (trx) => {
      await sql`set local statement_timeout='5s'`.execute(trx);
      await sql`update insight_reports set status='failed', stage='complete', error='stale-run', "finishedAt"=clock_timestamp(), "inputSnapshot"=null where status='running' and "heartbeatAt"<clock_timestamp()-interval '5 minutes'`.execute(
        trx,
      );
    });
    if (hourly) await sweepHealth();
  } catch (error) {
    log("housekeeping.expiry-failed", { sqlstate: sqlstate(error) }, "warn");
  }
}
export function startHousekeeping() {
  const state = runtimeState();
  if (state.sweepTimer) return;
  let nextHourly = 0;
  const tick = async () => {
    const hourly = Date.now() >= nextHourly;
    try {
      await sweep(hourly);
    } finally {
      if (hourly) nextHourly = Date.now() + 60 * 60_000;
      state.sweepTimer = setTimeout(tick, 60_000);
      state.sweepTimer.unref();
    }
  };
  state.sweepTimer = setTimeout(tick, 60_000);
  state.sweepTimer.unref();
}
