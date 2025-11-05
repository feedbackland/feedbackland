"server-only";

import { db } from "@/db/db";
import {
  clean,
  generateSQLEmbedding,
  getImageUrls,
  getPlainText,
  isInappropriateCheck,
} from "@/lib/utils-server";

export const updateCommentQuery = async ({
  commentId,
  orgId,
  userId,
  content,
}: {
  commentId: string;
  orgId: string;
  userId: string;
  content: string;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const { role } = await trx
        .selectFrom("user_org")
        .select("role")
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .select("user_org.role")
        .executeTakeFirstOrThrow();

      const { authorId } = await trx
        .selectFrom("comment")
        .where("id", "=", commentId)
        .select("comment.authorId")
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        const imageUrls = getImageUrls(content);
        const plainText = getPlainText(content);

        const isInappropriate = await isInappropriateCheck({
          orgId,
          plainText,
          imageUrls,
        });

        if (isInappropriate) {
          throw new Error("inappropriate-content");
        }

        const embedding = await generateSQLEmbedding(plainText);

        return await trx
          .updateTable("comment")
          .set({ content: clean(content), embedding })
          .where("id", "=", commentId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to update this comment");
      }
    });
  } catch (error) {
    throw error;
  }
};
