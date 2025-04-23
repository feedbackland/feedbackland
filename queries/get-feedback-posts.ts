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
    // Define the base query using a CTE to calculate commentCount
    let query = db
      .with("feedback_with_comment_count", (db) =>
        db
          .selectFrom("feedback")
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
            "feedback.status", // Include status for filtering
            (eb) =>
              eb.fn
                .coalesce(
                  // Coalesce to ensure 0 instead of null
                  eb
                    .selectFrom("comment")
                    .select(eb.fn.countAll<string>().as("count")) // Kysely needs string count here
                    .whereRef("comment.postId", "=", "feedback.id"),
                  sql<number>`0`, // Fallback value 0
                )
                .as("commentCount"),
          ])
          .where("feedback.orgId", "=", orgId),
      )
      // Select from the CTE and join user_upvote
      .selectFrom("feedback_with_comment_count")
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback_with_comment_count.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
      .select([
        "feedback_with_comment_count.id",
        "feedback_with_comment_count.createdAt",
        "feedback_with_comment_count.updatedAt",
        "feedback_with_comment_count.orgId",
        "feedback_with_comment_count.authorId",
        "feedback_with_comment_count.category",
        "feedback_with_comment_count.title",
        "feedback_with_comment_count.description",
        "feedback_with_comment_count.upvotes",
        "feedback_with_comment_count.commentCount", // Select from CTE
        "feedback_with_comment_count.status", // Select status from CTE
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
      ]);

    // Apply status filter to the CTE results
    if (status) {
      query = query.where("feedback_with_comment_count.status", "=", status);
    }

    // Apply ordering and cursor logic using CTE columns
    if (orderBy === "newest") {
      query = query
        .orderBy("feedback_with_comment_count.createdAt", "desc")
        .orderBy("feedback_with_comment_count.id", "desc"); // Secondary sort key
      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb(
              "feedback_with_comment_count.createdAt",
              "<",
              new Date(cursor.createdAt),
            ),
            eb.and([
              eb(
                "feedback_with_comment_count.createdAt",
                "=",
                new Date(cursor.createdAt),
              ),
              eb("feedback_with_comment_count.id", "<", cursor.id), // Use secondary key
            ]),
          ]),
        );
      }
    } else if (orderBy === "upvotes") {
      query = query
        .orderBy("feedback_with_comment_count.upvotes", "desc")
        .orderBy("feedback_with_comment_count.id", "desc"); // Secondary sort key
      if (cursor) {
        // Assuming upvotes is numeric or comparable string
        query = query.where((eb) =>
          eb.or([
            eb(
              "feedback_with_comment_count.upvotes",
              "<",
              String(cursor.upvotes),
            ),
            eb.and([
              eb(
                "feedback_with_comment_count.upvotes",
                "=",
                String(cursor.upvotes),
              ),
              eb("feedback_with_comment_count.id", "<", cursor.id), // Use secondary key
            ]),
          ]),
        );
      }
    } else if (orderBy === "comments") {
      // Order by count DESC, then ID DESC as tie-breaker
      query = query
        .orderBy("feedback_with_comment_count.commentCount", "desc") // No longer need nulls last
        .orderBy("feedback_with_comment_count.id", "desc");

      if (cursor) {
        // Keyset pagination logic for DESC primary / DESC secondary
        // Since commentCount is never null, we only need the logic for numeric comparison
        query = query.where((eb) =>
          eb.or([
            // Rows with count < cursor.commentCount (these come after cursor in DESC order)
            eb(
              "feedback_with_comment_count.commentCount",
              "<",
              cursor.commentCount,
            ),
            // Rows with count = cursor.commentCount and id < cursor.id (tie-breaker for DESC secondary sort)
            eb.and([
              eb(
                "feedback_with_comment_count.commentCount",
                "=",
                cursor.commentCount,
              ),
              eb("feedback_with_comment_count.id", "<", cursor.id),
            ]),
          ]),
        );
      }
    }

    // Execute the final query
    const feedbackPosts = await query.limit(limit + 1).execute();

    let nextCursor: typeof cursor | undefined = undefined;

    if (feedbackPosts.length > limit) {
      const nextItem = feedbackPosts.pop(); // Remove the extra item

      if (nextItem) {
        nextCursor = {
          id: nextItem.id,
          commentCount: Number(nextItem.commentCount),
          upvotes: Number(nextItem.upvotes),
          createdAt: nextItem.createdAt.toISOString(),
        };
      }
    }

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error: any) {
    console.error("Error in getFeedbackPostsQuery:", error); // Add logging
    throw error;
  }
};
