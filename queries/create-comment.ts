"server-only";

import { db } from "@/db/db";
import {
  clean,
  generateEmbedding,
  getImageUrls,
  getPlainText,
  isInappropriateCheck,
} from "@/lib/utils-server";

export async function createCommentQuery({
  orgId,
  content,
  authorId,
  postId,
  parentCommentId,
}: {
  orgId: string;
  content: string;
  authorId: string;
  postId: string;
  parentCommentId: string | null;
}) {
  try {
    const imageUrls = getImageUrls(content);
    const plainText = getPlainText(content);

    const [isInappropriate, embedding] = await Promise.all([
      isInappropriateCheck({
        orgId,
        plainText,
        imageUrls,
      }),
      generateEmbedding(plainText),
    ]);

    if (isInappropriate) {
      throw new Error("inappropriate-content");
    }

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
  } catch (error) {
    throw error;
  }
}
