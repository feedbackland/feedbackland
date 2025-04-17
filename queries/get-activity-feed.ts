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

  const feedback = db
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
    ]);

  const comments = db
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
    ]);

  let baseQuery = db
    .selectFrom(feedback.unionAll(comments).as("union"))
    .where("union.orgId", "=", orgId);

  if (status) {
    baseQuery = baseQuery.where("union.status", "=", status);
  }

  let itemsQuery = baseQuery;

  if (orderBy === "newest") {
    itemsQuery = itemsQuery.orderBy("union.createdAt", "desc");
  } else if (orderBy === "upvotes") {
    itemsQuery = itemsQuery.orderBy("union.upvotes", "desc");
  } else if (orderBy === "comments") {
    // Note: Ordering by commentCount might require adjustments if it's not directly available after the subquery wrap.
    // Assuming it's implicitly handled or needs further refinement if this order is used.
    // For now, let's keep the original logic structure but apply it to the subquery alias.
    // If 'commentCount' isn't directly selectable here, this might need a different approach.
    itemsQuery = itemsQuery.orderBy("union.commentCount", "desc");
  }

  itemsQuery = itemsQuery.selectAll("union").limit(pageSize).offset(offset);

  const countQuery = baseQuery.select((eb) =>
    eb.fn.countAll<string>().as("count"),
  );

  try {
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
}
