import "server-only";
import { sql } from "kysely";
import { contentTransaction } from "../../db/content-transaction";
import { requireAdmin, type Actor } from "../auth/authorization";

export async function adminUsage(actor: Actor, signal?: AbortSignal) {
  return contentTransaction(signal, async (trx) => {
    await requireAdmin(trx, actor);
    const usage = await sql<{
      period: "today" | "month" | "30days";
      feature: string;
      calls: string;
      errors: string;
      input: string;
      output: string;
      cost: string;
      uncosted: string;
    }>`
      with utc as (select (clock_timestamp() at time zone 'UTC')::date as today),
      periods as (select p.* from utc cross join lateral (values ('today',today),('month',date_trunc('month',today)::date),('30days',today-29)) p(label,start))
      select p.label as period,u.feature,sum(calls)::text as calls,sum(errors)::text as errors,
        sum("inputTokens")::text as input,sum("outputTokens")::text as output,sum("costUsd")::text as cost,
        sum("uncostedCalls")::text as uncosted from periods p join llm_usage u on u.day>=p.start and u.day <= (select today from utc) group by p.label,u.feature order by p.label,u.feature`.execute(
      trx,
    );
    const {
      rows: [activity],
    } = await sql<{ posts: number; comments: number }>`select
      (select count(*)::int from feedback where "createdAt">=clock_timestamp()-interval '30 days') as posts,
      (select count(*)::int from comment where "createdAt">=clock_timestamp()-interval '30 days' and content not like 'Updated status to%') as comments`.execute(
      trx,
    );
    return { usage: usage.rows, activity };
  });
}
export async function noticeCounts(
  actor: Actor,
  since: Date | null,
  signal?: AbortSignal,
) {
  return contentTransaction(signal, async (trx) => {
    await requireAdmin(trx, actor);
    const {
      rows: [counts],
    } = await sql<{ unseen: number; unscreened: number }>`select
      (select count(*)::int from feedback f where not exists(select 1 from activity_seen s where s."itemId"=f.id and s."userId"=${actor.userId})) as unseen,
      (select (count(distinct "postId")+count(distinct "commentId"))::int from moderation_event where ${since}::timestamptz is not null and "createdAt">=${since}::timestamptz) as unscreened`.execute(
      trx,
    );
    return counts;
  });
}
