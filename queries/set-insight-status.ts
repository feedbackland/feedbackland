"server-only";

import { db } from "@/db/db";
import type { FeedbackStatus } from "@/lib/typings";

/**
 * Sets one status on every feedback post behind an insight.
 *
 * This is the only write the insights makes. Once an insight has been dealt
 * with, the admin says so here and all the feedback that produced it picks up
 * that status on the public board — instead of opening each post in turn.
 */
export const setInsightStatusQuery = async ({
  orgId,
  insightId,
  status,
}: {
  orgId: string;
  insightId: string;
  status: FeedbackStatus;
}) => {
  return await db.transaction().execute(async (trx) => {
    const insight = await trx
      .selectFrom("insights")
      .select(["insights.ids"])
      .where("insights.id", "=", insightId)
      .where("insights.orgId", "=", orgId)
      .executeTakeFirstOrThrow();

    const postIds = insight.ids ?? [];

    if (postIds.length === 0) return { insightId, status, postsUpdated: 0 };

    const result = await trx
      .updateTable("feedback")
      .set({ status })
      .where("feedback.orgId", "=", orgId)
      .where("feedback.id", "in", postIds)
      .executeTakeFirst();

    return {
      insightId,
      status,
      postsUpdated: Number(result.numUpdatedRows ?? 0),
    };
  });
};
