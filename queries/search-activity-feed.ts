"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { textEmbeddingModel } from "@/lib/gemini";
import { cosineDistance } from "pgvector/kysely";

export const searchActivityFeedQuery = async ({
  orgId,
  searchValue,
  page,
  pageSize,
}: {
  orgId: string;
  searchValue: string;
  page: number;
  pageSize: number;
}) => {
  const {
    embedding: { values },
  } = await textEmbeddingModel.embedContent(searchValue);

  const offset = (page - 1) * pageSize;
  const distanceThreshold = 0.5; // Define threshold for clarity

  // CTE for Feedback Posts with early filtering
  const feedbackCTE = db
    .selectFrom("feedback")
    .where("feedback.orgId", "=", orgId) // Filter by orgId early
    .where(cosineDistance("feedback.embedding", values), "<", distanceThreshold) // Filter by distance early
    .select([
      "feedback.orgId",
      "feedback.id",
      "feedback.id as postId",
      sql<any>`null`.as("commentId"),
      "feedback.createdAt",
      "feedback.title",
      "feedback.description as content",
      "feedback.upvotes",
      "feedback.category",
      "feedback.status",
      sql<string>`'post'`.as("type"),
      // Subquery for comment count - relies on index on comment.postId
      (eb) =>
        eb
          .selectFrom("comment")
          .select(eb.fn.countAll<string>().as("commentCount")) // Use <string> for count
          .whereRef("comment.postId", "=", "feedback.id")
          .as("commentCount"),
      cosineDistance("feedback.embedding", values).as("distance"), // Calculate distance
    ]);

  // CTE for Comments with early filtering
  const commentsCTE = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id")
    .where("feedback.orgId", "=", orgId) // Filter by orgId early (via join)
    .where(cosineDistance("comment.embedding", values), "<", distanceThreshold) // Filter by distance early
    .select([
      "feedback.orgId", // Selected from the joined feedback table
      "comment.id",
      "comment.postId",
      "comment.id as commentId",
      "comment.createdAt",
      sql<any>`null`.as("title"),
      "comment.content",
      "comment.upvotes",
      sql<any>`null`.as("category"),
      sql<any>`null`.as("status"), // Comments don't have status
      sql<string>`'comment'`.as("type"),
      sql<string>`'0'`.as("commentCount"), // Match type 'string' from feedbackCTE count
      cosineDistance("comment.embedding", values).as("distance"), // Calculate distance
    ]);

  // Combine filtered CTEs using UNION ALL
  const unionQuery = db.selectFrom(
    feedbackCTE.unionAll(commentsCTE).as("union"),
  );

  // Order by distance and add window function for total count
  const finalQuery = unionQuery
    .selectAll("union") // Select all columns from the union
    .orderBy("union.distance") // Order by relevance (distance)
    .select((eb) => [
      // Add the totalCount column
      sql<string>`count(*) OVER()`.as("totalCount"),
      // Kysely automatically includes columns from the 'from' source (unionQuery)
    ])
    .limit(pageSize)
    .offset(offset);

  try {
    const results = await finalQuery.execute();

    // Extract items and total count from the first result (if any)
    const items = results;
    const totalItems = results.length > 0 ? Number(results[0].totalCount) : 0;
    const count = totalItems.toString(); // Keep original count format if needed

    // Remove totalCount from individual items before returning
    // Also remove distance if it's not needed in the final result set
    const itemsWithoutExtras = items.map(
      ({ totalCount, distance, ...rest }) => rest,
    );

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items: itemsWithoutExtras,
      count, // Return the total count as a string
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
};
