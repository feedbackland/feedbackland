"server-only";

import { db } from "@/db/db";
import sanitize from "sanitize-html";
import { generateEmbedding, stripHtml } from "@/lib/utils";

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
    const embedding = await generateEmbedding(stripHtml(content));

    console.log("comment", content);
    console.log("sanitized comment", sanitize(content));

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
