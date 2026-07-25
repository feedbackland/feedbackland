"server-only";

import { db } from "@/db/db";
import type {
  FeedbackStatus,
  Insights,
  InsightsRun,
  Insight,
  InsightEffort,
  InsightSignals,
} from "@/lib/typings";

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asEffort = (value: unknown): InsightEffort =>
  value === "s" || value === "m" || value === "l" ? value : null;

/**
 * `signals` is written by the current generator, but a row can predate it
 * (or predate a field), so every read is defensive and the card falls back to
 * showing less rather than crashing.
 */
const asSignals = (value: unknown): InsightSignals | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const previous = raw.previous as Record<string, unknown> | null | undefined;

  return {
    reachScore: num(raw.reachScore),
    momentumScore: num(raw.momentumScore),
    severityScore: num(raw.severityScore),
    effortMultiplier: num(raw.effortMultiplier) || 1,
    postCount: num(raw.postCount),
    upvotes: num(raw.upvotes),
    commentCount: num(raw.commentCount),
    reach: num(raw.reach),
    recentPostCount: num(raw.recentPostCount),
    recentUpvotes: num(raw.recentUpvotes),
    recentCommentCount: num(raw.recentCommentCount),
    latestActivityAt:
      typeof raw.latestActivityAt === "string" ? raw.latestActivityAt : null,
    evidence: typeof raw.evidence === "string" ? raw.evidence : "",
    confidence: num(raw.confidence),
    previous: previous
      ? {
          priority: num(previous.priority),
          reach: num(previous.reach),
          postCount: num(previous.postCount),
          at: typeof previous.at === "string" ? previous.at : "",
        }
      : null,
  };
};

export const getInsightsQuery = async ({
  orgId,
}: {
  orgId: string;
}): Promise<Insights> => {
  const insightsPromise = db
    .selectFrom("insights")
    .selectAll()
    .where("insights.orgId", "=", orgId)
    .where("insights.isArchived", "=", false)
    .orderBy("insights.priority", "desc")
    .orderBy("insights.reach", "desc")
    .orderBy("insights.id", "desc")
    .execute();

  const runPromise = db
    .selectFrom("insight_reports")
    .selectAll()
    .where("insight_reports.orgId", "=", orgId)
    .orderBy("insight_reports.createdAt", "desc")
    .limit(1)
    .executeTakeFirst();

  // Every post's current status, so each insight's status can be rolled up from
  // the live board instead of from a copy that goes stale the moment someone
  // changes a status anywhere else. Also supplies the open-post count for the
  // first-run button, using the generator's own filter.
  const postsPromise = db
    .selectFrom("feedback")
    .select(["feedback.id", "feedback.status"])
    .where("feedback.orgId", "=", orgId)
    .execute();

  try {
    const [rows, runRow, posts] = await Promise.all([
      insightsPromise,
      runPromise,
      postsPromise,
    ]);

    const statusByPost = new Map(posts.map((post) => [post.id, post.status]));

    const openPostCount = posts.filter(
      (post) => post.status !== "done" && post.status !== "declined",
    ).length;

    const rollUpStatus = (postIds: string[]) => {
      const statuses = postIds
        .filter((id) => statusByPost.has(id))
        .map((id) => statusByPost.get(id) ?? null);

      if (statuses.length === 0) return { status: null, isMixedStatus: false };

      const first = statuses[0];
      const unanimous = statuses.every((status) => status === first);

      return {
        status: unanimous ? first : (null as FeedbackStatus),
        isMixedStatus: !unanimous,
      };
    };

    const insights: Insight[] = rows.map((row) => {
      const postIds = row.ids ?? [];

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        postIds,
        priority: num(row.priority),
        reach: num(row.reach),
        momentum: num(row.momentum),
        upvotes: num(row.upvotes),
        commentCount: num(row.commentCount),
        effort: asEffort(row.effort),
        ...rollUpStatus(postIds),
        category: row.category,
        signals: asSignals(row.signals),
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        // An insight that has only ever been seen in one run is new in that run.
        isNew: row.firstSeenAt.getTime() === row.lastSeenAt.getTime(),
      };
    });

    const run: InsightsRun | null = runRow
      ? {
          createdAt: runRow.createdAt,
          postsTotal: num(runRow.postsTotal),
          postsAnalyzed: num(runRow.postsAnalyzed),
          postsClustered: num(runRow.postsClustered),
          insightCount: num(runRow.insightCount),
          newInsightCount: num(runRow.newInsightCount),
          archivedInsightCount: num(runRow.archivedInsightCount),
          model: runRow.model,
        }
      : null;

    return { insights, run, openPostCount };
  } catch (error) {
    throw error;
  }
};
