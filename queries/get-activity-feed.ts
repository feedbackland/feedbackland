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
    .selectAll()
    .where("union.orgId", "=", orgId);

  if (status) {
    baseQuery = baseQuery.where("union.status", "=", status);
  }

  if (orderBy === "newest") {
    baseQuery = baseQuery.orderBy("union.createdAt", "desc");
  }

  if (orderBy === "upvotes") {
    baseQuery = baseQuery.orderBy("union.upvotes", "desc");
  }

  if (orderBy === "comments") {
    baseQuery = baseQuery.orderBy("union.commentCount", "desc");
  }

  try {
    const items = await baseQuery.limit(pageSize).offset(offset).execute();

    const [{ count }] = await baseQuery
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .execute();

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
