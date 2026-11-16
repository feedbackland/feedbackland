import "server-only";
import { db } from "@/db/db";
import { sql } from "kysely";
// Both figures describe the same database snapshot. The foreign keys remove
// deleted owners' events. Current coverage survives expiry of the history.
export const moderationCoverage = sql<{
  current: string;
  recent: string;
}>`select
    ((select count(*) from feedback where "moderationState" in ('unscreened','screened-text')) +
     (select count(*) from comment where "moderationState" in ('unscreened','screened-text'))) as current,
    (select count(distinct "postId") + count(distinct "commentId") from moderation_event
      where "createdAt" >= statement_timestamp() - interval '24 hours') as recent`;
export async function getModerationCoverageQuery() {
  const result = await moderationCoverage.execute(db);
  return {
    current: Number(result.rows[0].current),
    recent: Number(result.rows[0].recent),
  };
}
