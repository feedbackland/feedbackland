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
    )
    .where("orgId", "=", orgId);

  let query = baseQuery;

  if (status) {
    query = query.where("status", "=", status);
  }

  if (orderBy === "newest") {
    query = query.orderBy("createdAt", "desc");
  } else if (orderBy === "upvotes") {
    query = query.orderBy("upvotes", "desc");
  } else if (orderBy === "comments") {
    query = query.orderBy("commentCount", "desc");
  }

  const items = await query.limit(pageSize).offset(offset).execute();

  const [{ count }] = await baseQuery
    .select((eb) => eb.fn.count<string>("id").as("count"))
    .execute();

  const totalItems = Number(count);

  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    items,
    count,
    totalPages,
    currentPage: page,
  };
}
