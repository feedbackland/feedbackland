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

  // Define the search query for feedback
  const feedbackSearch = db.selectFrom("feedback").select([
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
    cosineDistance("feedback.embedding", values).as("distance"), // Specify table
  ]);

  // Define the search query for comments
  const commentSearch = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id") // Join needed for orgId
    .select([
      "feedback.orgId", // Select orgId from the joined feedback table
      "comment.id",
      "comment.postId",
      "comment.id as commentId",
      "comment.createdAt",
      sql<any>`null`.as("title"),
      "comment.content",
      "comment.upvotes",
      sql<any>`null`.as("category"),
      sql<any>`null`.as("status"),
      sql<string>`'comment'`.as("type"),
      cosineDistance("comment.embedding", values).as("distance"), // Specify table
    ]);

  // Combine the searches using UNION ALL
  const activitySearchUnion = feedbackSearch.unionAll(commentSearch);

  // Base query for filtering (items and count)
  const filteredQueryBase = db
    .selectFrom(activitySearchUnion.as("activity_search")) // Use the union as a subquery
    .where("activity_search.orgId", "=", orgId)
    .where("activity_search.distance", "<", 0.5); // Filter on the alias

  // Query for fetching items with ordering and pagination
  const itemsQuery = filteredQueryBase
    .selectAll("activity_search") // Select all columns from the subquery
    .orderBy("activity_search.distance") // Order by the alias
    .limit(pageSize)
    .offset(offset);

  // Query for counting total items with the same filters
  const countQuery = filteredQueryBase.select((eb) =>
    eb.fn.countAll<string>().as("count"),
  );

  try {
    // Execute both queries
    const items = await itemsQuery.execute();
    const [{ count }] = await countQuery.execute();

    const totalItems = Number(count);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items,
      count,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
};
