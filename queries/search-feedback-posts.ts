"server-only";

import { db } from "@/db/db";
import { textEmbeddingModel } from "@/lib/gemini";
import { cosineDistance } from "pgvector/kysely";
import { sql } from "kysely"; // Import sql from kysely

export const searchFeedbackPostsQuery = async ({
  orgId,
  userId,
  searchValue,
}: {
  orgId: string;
  userId?: string | null;
  searchValue: string;
}) => {
  try {
    const {
      embedding: { values },
    } = await textEmbeddingModel.embedContent(searchValue);

    const distance = cosineDistance("embedding", values);

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

    const results = await db
      .with("comment_counts", () => commentCountsCTE) // Use the CTE
      .selectFrom("feedback")
      .leftJoin("comment_counts", "comment_counts.postId", "feedback.id") // Join pre-aggregated counts
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId") // Join on feedback.id
          .on("user_upvote.userId", "=", userId || null),
      )
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
        distance.as("distance"), // Keep distance calculation
      ])
      .where("feedback.orgId", "=", orgId) // Keep org filter
      .where(distance, "<", 0.5)
      .orderBy(distance)
      .limit(50)
      .execute();

    return results;
  } catch (error) {
    throw error;
  }
};
