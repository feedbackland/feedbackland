"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { textEmbeddingModel } from "@/lib/gemini";
import { cosineDistance } from "pgvector/kysely";

export const searchActivityFeedQuery = async ({
  orgId,
  searchValue,
}: {
  orgId: string;
  searchValue: string;
}) => {
  const {
    embedding: { values },
  } = await textEmbeddingModel.embedContent(searchValue);

  const distance = cosineDistance("embedding", values);

  const results = db
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
    .orderBy(distance)
    .limit(10)
    .execute();

  return results;
};
