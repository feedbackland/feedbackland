"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { FeedbackCategory } from "@/lib/typings";

export const getActivityFeedMetaDataQuery = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  try {
    const feedbackCTE = db
      .selectFrom("feedback")
      .leftJoin("user", "feedback.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .select([
        "feedback.id",
        "feedback.category",
        sql<string>`'post'`.as("type"),
      ]);

    const commentsCTE = db
      .selectFrom("comment")
      .innerJoin("feedback", "comment.postId", "feedback.id")
      .leftJoin("user", "comment.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .select([
        "comment.id",
        sql<FeedbackCategory | null>`null`.as("category"),
        sql<string>`'comment'`.as("type"),
      ]);

    const activityQuery = db.selectFrom(
      feedbackCTE.unionAll(commentsCTE).as("activity"),
    );

    const finalQuery = activityQuery
      .leftJoin("activity_seen", (join) =>
        join
          .onRef("activity.id", "=", "activity_seen.itemId")
          .on("activity_seen.userId", "=", userId),
      )
      .select(() => [
        sql<number>`COUNT(CASE WHEN activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "totalUnseenCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'idea' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenIdeasPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'issue' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenIssuesPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'general feedback' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenGeneralFeedbackPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'comment' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenCommentCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'idea' THEN 1 END)::int`.as(
          "totalIdeasPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'issue' THEN 1 END)::int`.as(
          "totalIssuesPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'general feedback' THEN 1 END)::int`.as(
          "totalGeneralFeedbackPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'comment' THEN 1 END)::int`.as(
          "totalCommentCount",
        ),
      ]);

    const counts = await finalQuery.executeTakeFirst();

    return {
      totalUnseenCount: counts?.totalUnseenCount ?? 0,
      unseenIdeasPostCount: counts?.unseenIdeasPostCount ?? 0,
      unseenIssuesPostCount: counts?.unseenIssuesPostCount ?? 0,
      unseenGeneralFeedbackPostCount:
        counts?.unseenGeneralFeedbackPostCount ?? 0,
      unseenCommentCount: counts?.unseenCommentCount ?? 0,
      totalIdeasPostCount: counts?.totalIdeasPostCount ?? 0,
      totalIssuesPostCount: counts?.totalIssuesPostCount ?? 0,
      totalGeneralFeedbackPostCount: counts?.totalGeneralFeedbackPostCount ?? 0,
      totalCommentCount: counts?.totalCommentCount ?? 0,
    };
  } catch (error) {
    throw error;
  }
};
