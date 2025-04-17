import { db } from "@/db/db";
import { sql } from "kysely";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

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
  status: FeedbackStatus;
}) {
  const offset = (page - 1) * pageSize;

  // Define the core union logic separately
  const baseQuery = db
    .selectFrom("feedback")
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
      (eb) =>
        eb
          .selectFrom("comment")
          .select(eb.fn.countAll().as("commentCount"))
          .whereRef("comment.postId", "=", "feedback.id")
          .as("commentCount"),
    ])
    .unionAll(
      db
        .selectFrom("comment")
        .innerJoin("feedback", "comment.postId", "feedback.id")
        .select([
          "feedback.orgId",
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
          sql<any>`null`.as("commentCount"),
        ]),
    );

  // Base query for filtering (items and count)
  let query = db
    .selectFrom(baseQuery.as("activity")) // Use the union as a subquery
    .where("activity.orgId", "=", orgId);

  // Apply status filter if provided
  if (status) {
    query = query.where("activity.status", "=", status);
  }

  // Query for fetching items with ordering and pagination
  let itemsQuery = query;
  if (orderBy === "newest") {
    itemsQuery = itemsQuery.orderBy("activity.createdAt", "desc");
  } else if (orderBy === "upvotes") {
    itemsQuery = itemsQuery.orderBy("activity.upvotes", "desc");
  } else if (orderBy === "comments") {
    // Note: Ordering by commentCount might require adjustments if it's not directly available after the subquery wrap.
    // Assuming it's implicitly handled or needs further refinement if this order is used.
    // For now, let's keep the original logic structure but apply it to the subquery alias.
    // If 'commentCount' isn't directly selectable here, this might need a different approach.
    itemsQuery = itemsQuery.orderBy("activity.commentCount", "desc");
  }

  // Query for counting total items with the same filters
  const countQuery = query.select((eb) => eb.fn.countAll<string>().as("count"));

  try {
    // Execute both queries
    const items = await itemsQuery
      .selectAll("activity") // Select all columns from the subquery
      .limit(pageSize)
      .offset(offset)
      .execute();

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
}
