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
    const imageUrls = getImageUrls(content);
    const plainText = getPlainText(content);

    const isInappropriate = await isInappropriateCheck({
      plainText,
      imageUrls,
    });

    if (isInappropriate) {
      throw new Error("inappropriate-content");
    }

    const embedding = await generateEmbedding(plainText);

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
