"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { MOMENTUM_WINDOW_DAYS } from "@/lib/insights";

/**
 * Status-change comments are written by the admin panel itself
 * (hooks/use-update-status.ts). They are not user signal, so they must not
 * inflate an insight's comment count or its momentum.
 */
const STATUS_COMMENT_PREFIX = "Updated status to%";

/**
 * Everything the insights generator needs, in three round trips:
 * the open posts, who upvoted them and when, and how many posts exist in total
 * (so the run can be honest about what it did and did not read).
 *
 * Posts that are done or declined are left out: the insights is what is still
 * open, and excluding them is also what lets a finished insight drop off the
 * board on the next run.
 */
export const getInsightsInputs = async ({ orgId }: { orgId: string }) => {
  const windowStart = sql<Date>`now() - ${sql.raw(
    `interval '${MOMENTUM_WINDOW_DAYS} days'`,
  )}`;

  const postsPromise = db
    .selectFrom("feedback")
    .where("feedback.orgId", "=", orgId)
    .where((eb) =>
      eb.or([
        eb("feedback.status", "is", null),
        eb("feedback.status", "not in", ["done", "declined"]),
      ]),
    )
    .select([
      "feedback.id",
      "feedback.title",
      "feedback.description",
      "feedback.upvotes",
      "feedback.category",
      "feedback.createdAt",
      "feedback.authorId",
      (eb) =>
        eb
          .selectFrom("comment")
          .select(eb.fn.countAll<string>().as("count"))
          .whereRef("comment.postId", "=", "feedback.id")
          .where("comment.content", "not like", STATUS_COMMENT_PREFIX)
          .as("commentCount"),
      (eb) =>
        eb
          .selectFrom("comment")
          .select(eb.fn.countAll<string>().as("count"))
          .whereRef("comment.postId", "=", "feedback.id")
          .where("comment.content", "not like", STATUS_COMMENT_PREFIX)
          .where("comment.createdAt", ">=", windowStart)
          .as("recentCommentCount"),
    ])
    .orderBy("feedback.createdAt", "desc")
    .execute();

  // One row per upvote, so an insight can count distinct people rather than
  // summing per-post totals (the same user upvoting three duplicates of the
  // same request is one person asking, not three).
  const upvotesPromise = db
    .selectFrom("user_upvote")
    .innerJoin("feedback", "feedback.id", "user_upvote.contentId")
    .where("feedback.orgId", "=", orgId)
    .select([
      "user_upvote.contentId",
      "user_upvote.userId",
      "user_upvote.createdAt",
    ])
    .execute();

  const totalPromise = db
    .selectFrom("feedback")
    .where("feedback.orgId", "=", orgId)
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirst();

  try {
    const [posts, upvotes, total] = await Promise.all([
      postsPromise,
      upvotesPromise,
      totalPromise,
    ]);

    return {
      posts,
      upvotes,
      postsTotal: Number(total?.count ?? 0),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read feedback for the insights: ${reason}`);
  }
};

export type InsightsInputs = Awaited<ReturnType<typeof getInsightsInputs>>;
