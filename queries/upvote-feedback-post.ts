import { db } from "@/db/db";

export async function upvoteFeedbackPostQuery({
  userId,
  feedbackPostId,
}: {
  userId: string;
  feedbackPostId: string;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const userUpvote = await db
        .selectFrom("user_upvote")
        .where("user_upvote.userId", "=", userId)
        .where("user_upvote.postId", "=", feedbackPostId)
        .selectAll()
        .executeTakeFirst();

      const hasUpvote = !!userUpvote;

      if (hasUpvote) {
        await trx
          .updateTable("feedback")
          .set({
            upvotes: (eb) => eb("upvotes", "-", 1 as any),
          })
          .where("id", "=", feedbackPostId)
          .executeTakeFirstOrThrow();

        await trx
          .deleteFrom("user_upvote")
          .where("userId", "=", userId)
          .where("postId", "=", feedbackPostId)
          .executeTakeFirstOrThrow();
      } else {
        await trx
          .updateTable("feedback")
          .set({
            upvotes: (eb) => eb("upvotes", "+", 1 as any),
          })
          .where("id", "=", feedbackPostId)
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("user_upvote")
          .values({
            userId,
            postId: feedbackPostId,
          })
          .executeTakeFirstOrThrow();
      }

      return { success: true };
    });
  } catch (error) {
    console.error("Error for upvoteFeedbackPostQuery", error);
    throw error;
  }
}
