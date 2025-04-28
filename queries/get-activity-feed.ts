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

  const finalQuery = orderedQuery // This should be your base query builder instance selecting from 'activity'
    // Alias the joined table for clarity
    .leftJoin(
      "activity_seen", // Use an alias 'seen'
      (join) =>
        join
          // Reference the base table's ID (ensure 'activity.id' is correct)
          .onRef("activity.id", "=", "activity_seen.itemId")
          // Filter the join for the specific user *within* the ON clause
          .on("activity_seen.userId", "=", userId),
    )
    .selectAll()
    .select((eb) => [
      eb("activity_seen.userId", "is not", null).as("isSeen"),
      eb.fn.count("activity.id").over().as("totalItemsCount"),
      eb.fn
        .count("activity.id") // Count the activity if...
        .filterWhere("activity_seen.userId", "is", null) // ...it wasn't seen by the user
        .over() // Apply as a window function over the whole set
        .as("unseenItemsCount"),
    ])
    // Apply pagination *after* selections and window functions
    .limit(pageSize)
    .offset(offset);

  try {
    const results = await finalQuery.execute();

    const items = results;
    const totalItemsCount =
      results.length > 0 ? Number(results[0].totalItemsCount) : 0;
    const unseenItemsCount =
      results.length > 0 ? Number(results[0].unseenItemsCount) : 0;

    const itemsWithoutTotalCount: ActivityFeedItem[] = items.map(
      ({ totalItemsCount, unseenItemsCount, isSeen, ...rest }) => {
        return { ...rest, isSeen: Boolean(isSeen) };
      },
    );

    const totalPages = Math.ceil(totalItemsCount / pageSize);

    return {
      items: itemsWithoutTotalCount,
      totalItemsCount,
      unseenItemsCount,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    throw error;
  }
}
