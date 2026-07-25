"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import type {
  FeedbackCategory,
  InsightEffort,
  InsightSignals,
} from "@/lib/typings";

export type InsightWrite = {
  /** Id of the insight this cluster continues, or null when it is new. */
  existingId: string | null;
  title: string;
  description: string;
  ids: string[];
  priority: number;
  reach: number;
  momentum: number;
  upvotes: number;
  commentCount: number;
  category: FeedbackCategory;
  effort: InsightEffort;
  signals: InsightSignals;
};

export type InsightsRunWrite = {
  postsTotal: number;
  postsAnalyzed: number;
  postsClustered: number;
  insightCount: number;
  newInsightCount: number;
  archivedInsightCount: number;
  model: string;
};

/**
 * Writes a generated insights without destroying the previous one.
 *
 * Insights that continue from a previous run are updated in place, which is what
 * keeps an insight's `firstSeenAt` and the deltas attached to it. Insights whose
 * feedback has gone (resolved, declined, or deleted) are archived rather than
 * deleted, so nothing is lost and the run log can report how many dropped off.
 */
export const saveInsightsQuery = async ({
  orgId,
  insights,
  archiveIds,
  run,
}: {
  orgId: string;
  insights: InsightWrite[];
  archiveIds: string[];
  run: InsightsRunWrite;
}) => {
  return await db.transaction().execute(async (trx) => {
    const seenAt = new Date();

    for (const insight of insights) {
      const shared = {
        title: insight.title,
        description: insight.description,
        ids: insight.ids,
        priority: String(insight.priority),
        reach: String(insight.reach),
        momentum: String(insight.momentum),
        upvotes: String(insight.upvotes),
        commentCount: String(insight.commentCount),
        category: insight.category,
        effort: insight.effort,
        signals: sql<string>`${JSON.stringify(insight.signals)}::jsonb`,
      };

      if (insight.existingId) {
        // firstSeenAt is deliberately absent: it belongs to the insight's history,
        // not to this run.
        await trx
          .updateTable("insights")
          .set({ ...shared, lastSeenAt: seenAt, isArchived: false })
          .where("insights.id", "=", insight.existingId)
          .where("insights.orgId", "=", orgId)
          .execute();
      } else {
        await trx
          .insertInto("insights")
          .values({ orgId, ...shared })
          .execute();
      }
    }

    if (archiveIds.length > 0) {
      await trx
        .updateTable("insights")
        .set({ isArchived: true })
        .where("insights.orgId", "=", orgId)
        .where("insights.id", "in", archiveIds)
        .execute();
    }

    await trx
      .insertInto("insight_reports")
      .values({
        orgId,
        postsTotal: String(run.postsTotal),
        postsAnalyzed: String(run.postsAnalyzed),
        postsClustered: String(run.postsClustered),
        insightCount: String(run.insightCount),
        newInsightCount: String(run.newInsightCount),
        archivedInsightCount: String(run.archivedInsightCount),
        model: run.model,
      })
      .execute();

    return true;
  });
};

/** Insights the generator matches against, including archived ones. */
export const getExistingInsightsQuery = async ({ orgId }: { orgId: string }) => {
  return await db
    .selectFrom("insights")
    .select([
      "insights.id",
      "insights.ids",
      "insights.title",
      "insights.priority",
      "insights.reach",
      "insights.isArchived",
      "insights.lastSeenAt",
      "insights.signals",
    ])
    .where("insights.orgId", "=", orgId)
    .execute();
};
