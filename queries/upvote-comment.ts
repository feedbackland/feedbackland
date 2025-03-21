import { db } from "@/db/db";

export async function upvoteCommentQuery({
  userId,
  commentId,
}: {
  userId: string;
  commentId: string;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const userUpvote = await db
        .selectFrom("user_upvote")
        .where("user_upvote.userId", "=", userId)
        .where("user_upvote.contentId", "=", commentId)
        .selectAll()
        .executeTakeFirst();

      const hasUpvote = !!userUpvote;

      if (hasUpvote) {
        await trx
          .updateTable("comment")
          .set({
            upvotes: (eb) => eb("upvotes", "-", 1 as any),
          })
          .where("id", "=", commentId)
          .executeTakeFirstOrThrow();

        await trx
          .deleteFrom("user_upvote")
          .where("userId", "=", userId)
          .where("contentId", "=", commentId)
          .executeTakeFirstOrThrow();
      } else {
        await trx
          .updateTable("comment")
          .set({
            upvotes: (eb) => eb("upvotes", "+", 1 as any),
          })
          .where("id", "=", commentId)
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("user_upvote")
          .values({
            userId,
            contentId: commentId,
          })
          .executeTakeFirstOrThrow();
      }

      return { success: true };
    });
  } catch (error) {
    console.error("Error for upvoteCommentQuery", error);
    throw error;
  }
}
