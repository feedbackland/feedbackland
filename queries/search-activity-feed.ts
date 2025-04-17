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

  const distance = cosineDistance("embedding", values);

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
      cosineDistance("embedding", values).as("distance"),
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
          cosineDistance("embedding", values).as("distance"),
        ]),
    )
    .where("orgId", "=", orgId)
    .where(distance, "<", 0.4)
    .orderBy(distance);

  const items = await baseQuery.limit(pageSize).offset(offset).execute();

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
};
