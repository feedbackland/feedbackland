import "server-only";
import { sql, type Transaction } from "kysely";
import type { DB } from "@/db/schema";
import { MOMENTUM_HALF_LIFE_DAYS, MOMENTUM_WINDOW_DAYS } from "@/lib/insights";
import type { FeedbackCategory } from "@/lib/typings";

export type InsightPost = {
  id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  created: number;
  upvotes: number;
  anonymous: boolean;
  votesLimited: boolean;
  commentsLimited: boolean;
  comments: number;
  recentComments: number;
  recentVotes: number;
  voteMomentum: number;
  lastVote: number | null;
};
export type InsightSnapshot = {
  at: number;
  posts: InsightPost[];
  // Hexadecimal membership bitmap, most significant bit first, and number of people.
  audience: [string, number][];
};
export const participationLimit = 1024;
const maxSnapshotBytes = 2 * 1024 * 1024;

export async function getInsightsInputs(trx: Transaction<DB>) {
  let limit = 2000;
  for (;;) {
    // One statement freezes text, votes, comments and totals at one MVCC snapshot.
    // Size the individual JSONB members before aggregating or transferring them.
    const {
      rows: [row],
    } = await sql<{
      snapshot: InsightSnapshot | null;
      total: number;
      bytes: number;
      n: number;
    }>`
      with newest as materialized (
        select id, left(title,160) as title, left("plainText",700) as description,
          category,"createdAt","authorId",upvotes
        from feedback where status is null or status not in ('done','declined')
        order by "createdAt" desc,id limit ${limit}
      ), posts as materialized (
        select *, row_number() over(order by "createdAt" desc,id)::int as ordinal from newest
      ), sampled_votes as materialized (
        select p.ordinal,v."userId",v."createdAt",v.position from posts p cross join lateral (
          select sample.*,row_number() over(order by "createdAt" desc,"userId") as position from (
            select "userId","createdAt" from user_upvote where "contentId"=p.id
            order by "createdAt" desc,"userId" limit ${participationLimit + 1}
          ) sample
        ) v
      ), votes as (
        select * from sampled_votes where position<=${participationLimit}
      ), memberships as (
        select bit_or(set_bit(repeat('0',${limit})::varbit,ordinal-1,1)) as bits from (
          select ordinal,"userId" as person from votes union all
          select ordinal,"authorId" from posts where "authorId" is not null
        ) support group by person
      ), audience as materialized (
        -- PostgreSQL's varbit wire format has a four-byte bit length followed by packed bits.
        select jsonb_build_array(rtrim(encode(substring(varbit_send(bits) from 5),'hex'),'0'),count(*)) as item
        from memberships group by bits
      ), demand as (
        select ordinal, count(*) filter(where "createdAt">=transaction_timestamp()-${MOMENTUM_WINDOW_DAYS}*interval '1 day' and position<=${participationLimit}) as recent,
          sum(power(2::double precision,-greatest(0,extract(epoch from (transaction_timestamp()-"createdAt")))::double precision / ${86400 * MOMENTUM_HALF_LIFE_DAYS})) filter (where position<=${participationLimit}) as momentum,
          count(*)>${participationLimit} as limited,max("createdAt") as latest from sampled_votes group by ordinal
      ), entries as materialized (
        select p.ordinal,jsonb_build_object('id',p.id,'title',p.title,'description',p.description,'category',p.category,
          'anonymous',p."authorId" is null,'votesLimited',coalesce(d.limited,false),'commentsLimited',c.limited,'created',floor(extract(epoch from p."createdAt")*1000),'upvotes',p.upvotes,
          'comments',c.total,'recentComments',c.recent,'recentVotes',coalesce(d.recent,0),
          'voteMomentum',coalesce(d.momentum,0),'lastVote',floor(extract(epoch from d.latest)*1000)) as item
        from posts p left join demand d using(ordinal)
        cross join lateral (
          select least(count(*),${participationLimit}) as total,count(*)>${participationLimit} as limited,
            least(count(*) filter(where "createdAt">=transaction_timestamp()-${MOMENTUM_WINDOW_DAYS}*interval '1 day'),${participationLimit}) as recent
          from (select "createdAt" from comment where "postId"=p.id and content not like 'Updated status to%'
            order by "createdAt" desc,id limit ${participationLimit + 1}) recent_comments
        ) c
      ), size as (
        select (100+coalesce((select sum(octet_length(item::text)+2) from entries),0)
          +coalesce((select sum(octet_length(item::text)+2) from audience),0))::float8 as bytes
      )
      select bytes,(select count(*)::float8 from feedback) as total,(select count(*)::int from entries) as n,
        case when bytes<=${maxSnapshotBytes} then jsonb_build_object(
          'at',floor(extract(epoch from transaction_timestamp())*1000),
          'posts',coalesce((select jsonb_agg(item order by ordinal) from entries),'[]'),
          'audience',coalesce((select jsonb_agg(item order by item) from audience),'[]')) end as snapshot
      from size`.execute(trx);
    if (row.snapshot) return { snapshot: row.snapshot, total: row.total };
    // A single bounded post has only one audience cohort, regardless of its votes.
    if (row.n <= 1)
      throw new Error("Insight snapshot exceeded its storage bound");
    limit = Math.max(
      1,
      Math.min(row.n - 1, Math.floor((row.n * maxSnapshotBytes) / row.bytes)),
    );
  }
}
