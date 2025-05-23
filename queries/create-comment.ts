"server-only";

import { db } from "@/db/db";
import { clean, getPlainText } from "@/lib/utils";
import { generateEmbedding } from "@/lib/utils-server";

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
