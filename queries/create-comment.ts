"server-only";

import { db } from "@/db/db";
import pgvector from "pgvector/pg";
import { textEmbeddingModel } from "@/lib/gemini";

export async function createCommentQuery({
  content,
  authorId,
  postId,
  parentCommentId,
}: {
  content: string;
  authorId: string;
  postId: string;
  parentCommentId: string | null;
}) {
  try {
    const embedding = pgvector.toSql(
      (await textEmbeddingModel.embedContent(content)).embedding.values,
    );

    const comment = await db
      .insertInto("comment")
      .values({
        content,
        authorId,
        postId,
        parentCommentId,
        embedding,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return comment;
  } catch (error: any) {
    throw error;
  }
}
