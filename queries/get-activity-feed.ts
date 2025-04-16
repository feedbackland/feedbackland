import { db } from "@/db/db";
import { sql } from "kysely";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export async function getActivityFeedQuery({
  orgId,
  limit,
  cursor,
  orderBy,
  status,
}: {
  orgId: string;
  limit: number;
  cursor?: {
    createdAt: string;
    id: string;
  } | null;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
}) {
  let query = db
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
        ]),
    )
    .where("orgId", "=", orgId)
    .limit(limit + 1);

  if (status) {
    query = query.where("status", "=", status);
  }

  if (orderBy === "newest") {
    query = query.orderBy("createdAt", "desc");

    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb("createdAt", "<", new Date(cursor.createdAt)),
          eb.and([
            eb("createdAt", "=", new Date(cursor.createdAt)),
            eb("id", "<", cursor.id),
          ]),
        ]),
      );
    }
  } else if (orderBy === "upvotes") {
    query = query.orderBy("upvotes", "desc");

    if (cursor) {
      query = query.where("id", ">", cursor.id);
    }
  }

  const items = await query.execute();

  let nextCursor: typeof cursor | undefined = undefined;

  if (items.length > limit) {
    const nextItem = items.pop();

    if (nextItem) {
      nextCursor = {
        id: nextItem?.id,
        createdAt: nextItem.createdAt.toISOString(),
      };
    }
  }

  return {
    data: items,
    nextCursor,
  };
}
