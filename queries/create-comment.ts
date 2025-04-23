"server-only";

import { db } from "@/db/db";
import pgvector from "pgvector/pg";
import { textEmbeddingModel } from "@/lib/gemini";
import sanitize from "sanitize-html";
import { stripHtml } from "@/lib/utils";

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
    const plainTextContent = stripHtml(content);
    const embeddedContent =
      await textEmbeddingModel.embedContent(plainTextContent);
    const vector = embeddedContent.embedding.values;
    const embedding = pgvector.toSql(vector);

    const comment = await db
      .insertInto("comment")
      .values({
        content: sanitize(content),
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
