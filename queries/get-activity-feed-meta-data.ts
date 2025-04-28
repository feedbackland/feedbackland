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
        // Total unseen count
        sql<number>`COUNT(CASE WHEN activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "totalUnseenCount",
        ),
        // Unseen counts by category/type
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'feature request' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenFeatureRequestPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'bug report' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenBugReportPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'general feedback' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenGeneralFeedbackPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'comment' AND activity_seen."userId" IS NULL THEN 1 END)::int`.as(
          "unseenCommentCount",
        ),
        // Total counts by category/type (seen and unseen)
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'feature request' THEN 1 END)::int`.as(
          "totalFeatureRequestPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'bug report' THEN 1 END)::int`.as(
          "totalBugReportPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'post' AND activity.category = 'general feedback' THEN 1 END)::int`.as(
          "totalGeneralFeedbackPostCount",
        ),
        sql<number>`COUNT(CASE WHEN activity.type = 'comment' THEN 1 END)::int`.as(
          "totalCommentCount",
        ),
      ]);

    // Execute the query - it will return a single row with all the counts
    const counts = await finalQuery.executeTakeFirst();

    // Return the counts, ensuring defaults if the query somehow returns nothing
    return {
      totalUnseenCount: counts?.totalUnseenCount ?? 0,
      unseenFeatureRequestPostCount: counts?.unseenFeatureRequestPostCount ?? 0,
      unseenBugReportPostCount: counts?.unseenBugReportPostCount ?? 0,
      unseenGeneralFeedbackPostCount:
        counts?.unseenGeneralFeedbackPostCount ?? 0,
      unseenCommentCount: counts?.unseenCommentCount ?? 0,
      totalFeatureRequestPostCount: counts?.totalFeatureRequestPostCount ?? 0,
      totalBugReportPostCount: counts?.totalBugReportPostCount ?? 0,
      totalGeneralFeedbackPostCount: counts?.totalGeneralFeedbackPostCount ?? 0,
      totalCommentCount: counts?.totalCommentCount ?? 0,
    };
  } catch (error: any) {
    throw error;
  }
};
