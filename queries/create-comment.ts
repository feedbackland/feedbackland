"server-only";

import { db } from "@/db/db";

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
    const comment = await db
      .insertInto("comment")
      .values({
        content,
        authorId,
        postId,
        parentCommentId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return comment;
  } catch (error: any) {
    throw error;
  }
}
