import { db } from "@/db/db";

export async function upvoteCommentQuery({
  userId,
  commentId,
  allowUndo = true,
}: {
  userId: string;
  commentId: string;
  allowUndo?: boolean;
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

      if (hasUpvote && allowUndo) {
        await trx
          .updateTable("comment")
          .set({
            upvotes: (eb) => eb("upvotes", "-", "1"),
          })
          .where("id", "=", commentId)
          .executeTakeFirstOrThrow();

        await trx
          .deleteFrom("user_upvote")
          .where("userId", "=", userId)
          .where("contentId", "=", commentId)
          .executeTakeFirstOrThrow();
      }

      if (!hasUpvote) {
        await trx
          .updateTable("comment")
          .set({
            upvotes: (eb) => eb("upvotes", "+", "1"),
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
