import "server-only";
import { sql } from "kysely";
import { contentTransaction } from "@/db/content-transaction";
import type { InsightResult } from "@/lib/jobs/insight-analysis";
import { requireLease } from "@/lib/jobs/leases";
import { AiError } from "@/lib/llm/errors";
import { requireDispatch, type Configuration } from "@/lib/llm/settings-store";
import type { Reservation } from "@/lib/llm/usage";

type Previous = {
  i: number;
  id: string;
  similarity: number;
  priority: number;
  reach: number;
  postCount: number;
  seen: Date;
  hasSignals: boolean;
};

export async function saveInsightsQuery(
  run: Reservation,
  config: Configuration,
  insights: InsightResult[],
  signal: AbortSignal,
) {
  const outputLimit = 1024 * 1024;
  if (Buffer.byteLength(JSON.stringify(insights)) >= outputLimit)
    throw new AiError("response-too-large");
  const lease = {
    name: "insight:" + run.runId,
    holder: run.owner,
    fence: run.fence,
  };
  await contentTransaction(signal, async (trx) => {
    await requireDispatch(trx, config, "ordinary");
    await requireLease(trx, lease);
    const current = trx
      .selectFrom("insight_reports")
      .where("id", "=", run.runId)
      .where("owner", "=", run.owner)
      .where("fence", "=", run.fence)
      .where("configToken", "=", config.token)
      .where("status", "=", "running")
      .where("stage", "=", "admitted")
      .where("reservationId", "=", run.id)
      .where("reservationCount", "=", 0);
    if (!(await current.select("id").forUpdate().executeTakeFirst()))
      throw new AiError("RESERVATION_EXPIRED");
    // The strongest overlap wins one-to-one. At most 59 other new themes can
    // claim an old ID, so 60 matches per candidate suffice even with long history.
    const { rows } = await sql<Previous>`with incoming as (
      select (n-1)::int as i,array(select jsonb_array_elements_text(member)) as ids
      from jsonb_array_elements(${JSON.stringify(insights.map((v) => v.ids))}::jsonb) with ordinality t(member,n))
      select g.i,c.* from incoming g cross join lateral (
        select old.id,old.priority::float8,old.reach::float8,cardinality(old.ids) as "postCount",old."lastSeenAt" as seen,
          (jsonb_typeof(old.signals)='object') as "hasSignals",
          n::float8/(cardinality(old.ids)+cardinality(g.ids)-n) as similarity
        from insights old cross join lateral(select count(*) as n from unnest(g.ids) a where a=any(old.ids)) gap
        where old.ids && g.ids and (n::float8/(cardinality(old.ids)+cardinality(g.ids)-n)>=0.3
          or (n>=2 and n::float8/least(cardinality(old.ids),cardinality(g.ids))>=0.6))
        order by similarity desc,old."lastSeenAt" desc,old.id limit 60) c
      order by c.similarity desc,g.i,c.seen desc,c.id`.execute(trx);
    const matches = new Map<number, Previous>(),
      used = new Set<string>();
    for (const row of rows) {
      if (matches.has(row.i) || used.has(row.id)) continue;
      matches.set(row.i, row);
      used.add(row.id);
    }
    const output = insights.map((item, i) => {
      const old = matches.get(i);
      const signals = {
        ...item.signals,
        previous: old?.hasSignals
          ? {
              priority: old.priority,
              reach: old.reach,
              postCount: old.postCount,
              at: old.seen.toISOString(),
            }
          : null,
      };
      return { ...item, signals };
    });
    if (Buffer.byteLength(JSON.stringify(output)) >= outputLimit)
      throw new AiError("response-too-large");
    const published: string[] = [];
    for (const [i, item] of output.entries()) {
      const old = matches.get(i);
      const values = {
        ...item,
        priority: String(item.priority),
        reach: String(item.reach),
        momentum: String(item.momentum),
        upvotes: String(item.upvotes),
        commentCount: String(item.commentCount),
        signals: sql<string>`${JSON.stringify(item.signals)}::jsonb`,
      };
      if (old) {
        await trx
          .updateTable("insights")
          .where("id", "=", old.id)
          .set({
            ...values,
            isArchived: false,
            lastSeenAt: sql`clock_timestamp()`,
          })
          .executeTakeFirstOrThrow();
        published.push(old.id);
      } else {
        const created = await trx
          .insertInto("insights")
          .values(values)
          .returning("id")
          .executeTakeFirstOrThrow();
        published.push(created.id);
      }
    }
    const archived = await trx
      .updateTable("insights")
      .where("isArchived", "=", false)
      .where("id", "not in", published)
      .set({ isArchived: true })
      .executeTakeFirstOrThrow();
    const saved = await trx
      .updateTable("insight_reports")
      .where("id", "=", run.runId)
      .where("status", "=", "running")
      .where("owner", "=", run.owner)
      .where("fence", "=", run.fence)
      .set({
        status: "succeeded",
        stage: "complete",
        finishedAt: sql`clock_timestamp()`,
        inputSnapshot: null,
        requestPlan: null,
        error: null,
        postsClustered: String(
          insights.reduce((sum, insight) => sum + insight.ids.length, 0),
        ),
        insightCount: String(published.length),
        newInsightCount: String(published.length - matches.size),
        archivedInsightCount: String(archived.numUpdatedRows),
      })
      .executeTakeFirstOrThrow();
    if (saved.numUpdatedRows !== 1n) throw new AiError("RESERVATION_EXPIRED");
    await requireLease(trx, lease);
  });
}
