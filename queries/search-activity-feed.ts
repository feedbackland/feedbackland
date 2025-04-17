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
      cosineDistance("feedback.embedding", values).as("distance"),
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
      cosineDistance("comment.embedding", values).as("distance"),
    ]);

  const baseQuery = db
    .selectFrom(feedback.unionAll(comments).as("union"))
    .where("union.orgId", "=", orgId)
    .where("union.distance", "<", 0.5);

  try {
    const items = await baseQuery
      .select([
        "union.orgId",
        "union.id",
        "union.postId",
        "union.commentId",
        "union.createdAt",
        "union.title",
        "union.content",
        "union.upvotes",
        "union.category",
        "union.status",
        "union.type",
      ])
      .orderBy("union.distance")
      .limit(pageSize)
      .offset(offset)
      .execute();

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
};
