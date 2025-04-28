import { db } from "@/db/db";
import { sql } from "kysely";
import {
  ActivityFeedItem,
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
  userId, // Add userId parameter
}: {
  orgId: string;
  page: number;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status?: FeedbackStatus; // Make status optional if it can be undefined/null
  userId: string; // Add userId parameter type
}) {
  const offset = (page - 1) * pageSize;

  // CTE for Feedback Posts
  let feedbackQuery = db
    .selectFrom("feedback")
    .leftJoin("user", "feedback.authorId", "user.id") // Join with user table
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
    "user.id as authorId", // Select author's id
    "user.name as authorName", // Select author's name
    "feedback.title as postTitle", // Select parent post's title
  ]);

  // CTE for Comments
  const commentsCTE = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id")
    .leftJoin("user", "comment.authorId", "user.id") // Join with user table
    .where("feedback.orgId", "=", orgId) // Filter by orgId early
    .select([
      "feedback.orgId", // Selected from the joined feedback table
      "comment.id",
      "comment.postId",
      "comment.id as commentId",
      "comment.createdAt",
      sql<string>`null`.as("title"), // Comments don't have their own title
      "comment.content",
      "comment.upvotes",
      sql<FeedbackCategory | null>`null`.as("category"),
      sql<FeedbackStatus | null>`null`.as("status"), // Comments don't have status
      sql<string>`'comment'`.as("type"),
      sql<string>`'0'`.as("commentCount"), // Match type 'string' from feedbackCTE count
      "user.id as authorId", // Select author's id
      "user.name as authorName", // Select author's name
      "feedback.title as postTitle", // Select parent post's title
    ]);

  // Combine CTEs using activity ALL
  const activityQuery = db.selectFrom(
    feedbackCTE.unionAll(commentsCTE).as("activity"),
  );

  // Apply ordering
  let orderedQuery = activityQuery.selectAll("activity"); // Select all columns from the activity

  if (orderBy === "newest") {
    orderedQuery = orderedQuery.orderBy("activity.createdAt", "desc");
  } else if (orderBy === "upvotes") {
    // Ensure upvotes are treated numerically for sorting if they are numeric strings
    orderedQuery = orderedQuery.orderBy("activity.upvotes", "desc");
    // If upvotes is already a numeric type, just use:
    // orderedQuery = orderedQuery.orderBy('activity.upvotes', 'desc');
  } else if (orderBy === "comments") {
    // sql`CAST(activity.commentCount AS INTEGER)`
    orderedQuery = orderedQuery.orderBy("activity.commentCount", "desc");
  } else {
    // Default order if needed
    orderedQuery = orderedQuery.orderBy("activity.createdAt", "desc");
  }

  // Add LEFT JOIN for seen status and window function for total count
  const finalQuery = orderedQuery
    .leftJoin(
      "activity_seen",
      (join) =>
        join
          .onRef("activity.id", "=", "activity_seen.itemId")
          .on("activity_seen.userId", "=", userId), // Join based on the current user
    )
    // Select all columns from the orderedQuery (activity) and the joined activity_seen
    .selectAll()
    // Now add the calculated columns
    .select((eb) => [
      sql<string>`count(*) OVER()`.as("totalCount"), // Add the totalCount column
      sql<boolean>`activity_seen.user_id IS NOT NULL`.as("isSeen"), // Add the isSeen flag
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
    const itemsWithoutTotalCount: ActivityFeedItem[] = items.map(
      ({ totalCount, ...rest }) => rest,
    );

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
