"server-only";

import { db } from "@/db/db";
import {
  clean,
  generateEmbedding,
  getImageUrls,
  getPlainText,
  isInappropriateCheck,
} from "@/lib/utils-server";

export const updateFeedbackPostQuery = async ({
  postId,
  orgId,
  userId,
  title,
  description,
}: {
  postId: string;
  orgId: string;
  userId: string;
  title: string;
  description: string;
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
        .selectFrom("feedback")
        .where("id", "=", postId)
        .where("orgId", "=", orgId)
        .select("feedback.authorId")
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        const imageUrls = getImageUrls(description);
        const plainText = getPlainText(description);

        const isInappropriate = await isInappropriateCheck({
          orgId,
          plainText: `${title}: ${plainText}`,
          imageUrls,
        });

        if (isInappropriate) {
          throw new Error("inappropriate-content");
        }

        const embedding = await generateEmbedding(`${title}: ${plainText}`);

        return await trx
          .updateTable("feedback")
          .set({
            title,
            description: clean(description),
            embedding,
          })
          .where("id", "=", postId)
          .where("orgId", "=", orgId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to update this post");
      }
    });
  } catch (error) {
    throw error;
  }
};
