"server-only";

import { db } from "@/db/db";

export async function upvoteFeedbackPostQuery({
  userId,
  postId,
  allowUndo = true,
}: {
  userId: string;
  postId: string;
  allowUndo?: boolean;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const userUpvote = await trx
        .selectFrom("user_upvote")
        .where("user_upvote.userId", "=", userId)
        .where("user_upvote.contentId", "=", postId)
        .selectAll()
        .executeTakeFirst();

      const hasUpvote = !!userUpvote;

      if (hasUpvote && allowUndo) {
        await trx
          .updateTable("feedback")
          .set({
            upvotes: (eb) => eb("upvotes", "-", "1"),
          })
          .where("id", "=", postId)
          .execute();

        await trx
          .deleteFrom("user_upvote")
          .where("userId", "=", userId)
          .where("contentId", "=", postId)
          .execute();
      }

      if (!hasUpvote) {
        await trx
          .updateTable("feedback")
          .set({
            upvotes: (eb) => eb("upvotes", "+", "1"),
          })
          .where("id", "=", postId)
          .execute();

        await trx
          .insertInto("user_upvote")
          .values({
            userId,
            contentId: postId,
          })
          .execute();
      }

      return { success: true };
    });
  } catch (error) {
    console.error("Error for upvoteFeedbackPostQuery", error);
    throw error;
  }
}
