"server-only";

import { db } from "@/db/db";
import { sql } from "kysely"; // Import sql
import {
  FeedbackOrderBy,
  FeedbackPostsCursor,
  FeedbackStatus,
} from "@/lib/typings";

export const getFeedbackPostsQuery = async ({
  orgId,
  userId,
  limit,
  cursor,
  orderBy,
  status,
}: {
  orgId: string;
  userId?: string | null;
  limit: number;
  cursor: FeedbackPostsCursor | null | undefined;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
}) => {
  try {
    // CTE to pre-aggregate comment counts for the relevant org
    const commentCountsCTE = db
      .selectFrom("comment")
      .select([
        "comment.postId",
        sql<number>`COUNT(*)::int`.as("count"), // Ensure count is integer
      ])
      .innerJoin("feedback", "feedback.id", "comment.postId") // Join to filter comments by orgId indirectly
      .where("feedback.orgId", "=", orgId)
      .groupBy("comment.postId");

    // Main query starts here
    let query = db
      .with("comment_counts", () => commentCountsCTE) // Use the CTE
      .selectFrom("feedback")
      .where("feedback.orgId", "=", orgId) // Filter feedback by orgId
      .leftJoin("comment_counts", "comment_counts.postId", "feedback.id") // Join pre-aggregated counts
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId") // Join on feedback.id
          .on("user_upvote.userId", "=", userId || null),
      )
      // Select columns, calculating commentCount from the joined CTE
      .select([
        "feedback.id",
        "feedback.createdAt",
        "feedback.updatedAt",
        "feedback.orgId",
        "feedback.authorId",
        "feedback.category",
        "feedback.title",
        "feedback.description",
        "feedback.upvotes",
        "feedback.status",
        // Use COALESCE on the joined count, default to 0
        (eb) =>
          eb.fn
            .coalesce("comment_counts.count", sql<number>`0`)
            .as("commentCount"),
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
      ]);

    // Apply status filter directly to feedback table
    if (status) {
      query = query.where("feedback.status", "=", status);
    }

    // Apply ordering and cursor logic using direct table columns
    if (orderBy === "newest") {
      query = query
        .orderBy("feedback.createdAt", "desc")
        .orderBy("feedback.id", "desc"); // Secondary sort key
      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb("feedback.createdAt", "<", new Date(cursor.createdAt)),
            eb.and([
              eb("feedback.createdAt", "=", new Date(cursor.createdAt)),
              eb("feedback.id", "<", cursor.id), // Use secondary key
            ]),
          ]),
        );
      }
    } else if (orderBy === "upvotes") {
      query = query
        .orderBy("feedback.upvotes", "desc")
        .orderBy("feedback.id", "desc"); // Secondary sort key
      if (cursor) {
        // Revert to String comparison to satisfy Kysely's query builder types
        const cursorUpvotes = String(cursor.upvotes);
        query = query.where((eb) =>
          eb.or([
            // Compare column with string representation
            eb("feedback.upvotes", "<", cursorUpvotes),
            eb.and([
              eb("feedback.upvotes", "=", cursorUpvotes),
              eb("feedback.id", "<", cursor.id), // Use secondary key
            ]),
          ]),
        );
      }
    } else if (orderBy === "comments") {
      // Order by the calculated commentCount expression
      const commentCountExpr = (eb: any) =>
        eb.fn.coalesce("comment_counts.count", sql<number>`0`);
      query = query
        .orderBy(commentCountExpr, "desc") // Order by the expression
        .orderBy("feedback.id", "desc");

      if (cursor) {
        // Keyset pagination logic for DESC primary / DESC secondary
        const cursorCommentCount = Number(cursor.commentCount); // Already ensured non-null
        query = query.where((eb) =>
          eb.or([
            // Rows with count < cursor.commentCount
            eb(commentCountExpr(eb), "<", cursorCommentCount),
            // Rows with count = cursor.commentCount and id < cursor.id
            eb.and([
              eb(commentCountExpr(eb), "=", cursorCommentCount),
              eb("feedback.id", "<", cursor.id),
            ]),
          ]),
        );
      }
    }

    // Execute the final query
    const feedbackPosts = await query.limit(limit + 1).execute();

    let nextCursor: typeof cursor | undefined = undefined;

    if (feedbackPosts.length > limit) {
      const nextItem = feedbackPosts.pop();

      if (nextItem) {
        nextCursor = {
          id: nextItem.id,
          commentCount: Number(nextItem.commentCount), // Keep as number
          upvotes: Number(nextItem.upvotes), // Use Number as required by cursor type
          createdAt: nextItem.createdAt.toISOString(),
        };
      }
    }

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error: any) {
    throw error;
  }
};
