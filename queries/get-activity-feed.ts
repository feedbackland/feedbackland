import { db } from "@/db/db";
import { sql } from "kysely";
import {
  FeedbackCategory,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";

export async function getActivityFeedQuery({
  orgId,
  page,
  pageSize,
  orderBy,
  status,
}: {
  orgId: string;
  page: number;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status?: FeedbackStatus; // Make status optional if it can be undefined/null
}) {
  const offset = (page - 1) * pageSize;

  // CTE for Feedback Posts
  let feedbackQuery = db
    .selectFrom("feedback")
    .where("feedback.orgId", "=", orgId); // Filter by orgId early

  // Apply status filter if provided
  if (status) {
    feedbackQuery = feedbackQuery.where("feedback.status", "=", status);
  }

  const feedbackCTE = feedbackQuery.select([
    "feedback.orgId",
    "feedback.id",
    "feedback.id as postId",
    sql<string | null>`null`.as("commentId"),
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
  ]);

  // CTE for Comments
  const commentsCTE = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id")
    .where("feedback.orgId", "=", orgId) // Filter by orgId early
    .select([
      "feedback.orgId", // Selected from the joined feedback table
      "comment.id",
      "comment.postId",
      "comment.id as commentId",
      "comment.createdAt",
      sql<string>`null`.as("title"),
      "comment.content",
      "comment.upvotes",
      sql<FeedbackCategory | null>`null`.as("category"),
      sql<FeedbackStatus | null>`null`.as("status"), // Comments don't have status
      sql<string>`'comment'`.as("type"),
      sql<string>`'0'`.as("commentCount"), // Match type 'string' from feedbackCTE count
    ]);

  // Combine CTEs using UNION ALL
  const unionQuery = db.selectFrom(
    feedbackCTE.unionAll(commentsCTE).as("union"),
  );

  // Apply ordering
  let orderedQuery = unionQuery.selectAll("union"); // Select all columns from the union

  if (orderBy === "newest") {
    orderedQuery = orderedQuery.orderBy("union.createdAt", "desc");
  } else if (orderBy === "upvotes") {
    // Ensure upvotes are treated numerically for sorting if they are numeric strings
    orderedQuery = orderedQuery.orderBy("union.upvotes", "desc");
    // If upvotes is already a numeric type, just use:
    // orderedQuery = orderedQuery.orderBy('union.upvotes', 'desc');
  } else if (orderBy === "comments") {
    // sql`CAST(union.commentCount AS INTEGER)`
    orderedQuery = orderedQuery.orderBy("union.commentCount", "desc");
  } else {
    // Default order if needed
    orderedQuery = orderedQuery.orderBy("union.createdAt", "desc");
  }

  // Add window function for total count and apply pagination
  // orderedQuery already has all columns from the union via selectAll('union')
  const finalQuery = orderedQuery
    .select((eb) => [
      // Add the totalCount column
      sql<string>`count(*) OVER()`.as("totalCount"),
      // Kysely automatically includes columns from the 'from' source (orderedQuery)
      // when using the function form of select like this, unless explicitly excluded.
      // So, no need for ...eb.selection.columns here.
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
    const itemsWithoutTotalCount = items.map(({ totalCount, ...rest }) => rest);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items: itemsWithoutTotalCount,
      count, // Return the total count as a string
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
}
