import { db } from "@/db/db";
import { DB } from "@/db/schema";
import { ExpressionBuilder, sql } from "kysely";

interface ActivityFeedCursor {
  createdAt: string;
  id: string;
}

export async function getActivityFeedQuery({
  orgId,
  limit,
  cursor,
}: {
  orgId: string;
  limit: number;
  cursor?: ActivityFeedCursor | null;
}) {
  // Changed from const feedbackItems to let feedbackItemsQuery
  let feedbackItemsQuery = db
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
      sql<string>`'post'`.as("itemType"),
    ])
    .where("feedback.orgId", "=", orgId);

  let commentItemsQuery = db
    .selectFrom("comment")
    .innerJoin("feedback", "comment.postId", "feedback.id")
    .select([
      "comment.id",
      "comment.parentCommentId",
      "comment.postId",
      "comment.createdAt",
      "comment.updatedAt",
      "comment.authorId",
      "comment.content",
      "comment.upvotes",
      sql<string>`'comment'`.as("itemType"),
    ])
    .where("feedback.orgId", "=", orgId);

  // Apply cursor logic to both queries
  if (cursor) {
    const cursorCreatedAt =
      typeof cursor.createdAt === "string"
        ? new Date(cursor.createdAt)
        : cursor.createdAt;

    // Define a reusable filter function for cursor logic
    const cursorFilter = (eb: ExpressionBuilder<DB, "feedback">) =>
      eb.or([
        eb("createdAt", "<", cursorCreatedAt),
        eb.and([
          eb("createdAt", "=", cursorCreatedAt),
          eb("id", "<", cursor.id),
        ]),
      ]);

    feedbackItemsQuery = feedbackItemsQuery.where(cursorFilter);
    commentItemsQuery = commentItemsQuery.where(cursorFilter);
  }

  // Fetch results from both queries
  // We fetch limit + 1 from *each* initially to ensure we have enough data
  // to determine the correct combined order and next cursor after merging.
  const [feedbackResults, commentResults] = await Promise.all([
    feedbackItemsQuery
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(limit + 1)
      .execute(),
    commentItemsQuery
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(limit + 1)
      .execute(),
  ]);

  // Combine and sort results in TypeScript
  const combinedResults = [...feedbackResults, ...commentResults];

  combinedResults.sort((a, b) => {
    // Ensure createdAt is treated as Date objects for comparison
    const dateA =
      typeof a.createdAt === "string" ? new Date(a.createdAt) : a.createdAt;
    const dateB =
      typeof b.createdAt === "string" ? new Date(b.createdAt) : b.createdAt;

    if (dateB.getTime() !== dateA.getTime()) {
      return dateB.getTime() - dateA.getTime(); // Sort by date descending
    }
    // If dates are equal, sort by ID descending for stable order
    return b.id.localeCompare(a.id);
  });

  // Apply limit and determine next cursor
  const items = combinedResults.slice(0, limit);

  let nextCursor: ActivityFeedCursor | null = null;

  if (combinedResults.length > limit) {
    const nextItem = combinedResults[limit]; // The item right after the last one we return

    if (nextItem) {
      nextCursor = {
        createdAt: nextItem.createdAt.toISOString(),
        id: nextItem.id,
      };
    }
  }

  return {
    data: items,
    nextCursor,
  };
}
