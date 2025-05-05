"server-only";

import { db } from "@/db/db";
import { generateEmbedding, clean, getPlainText } from "@/lib/utils";

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
    const embedding = await generateEmbedding(getPlainText(content));

    console.log("clean comment: ", clean(content));

    const comment = await db
      .insertInto("comment")
      .values({
        content: clean(content),
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
