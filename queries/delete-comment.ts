"server-only";

import { db } from "@/db/db";

export async function deleteCommentQuery({
  commentId,
  userId,
  orgId,
}: {
  commentId: string;
  userId: string;
  orgId: string;
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      const { role } = await trx
        .selectFrom("user_org")
        .select("role")
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .executeTakeFirstOrThrow();

      const { authorId } = await trx
        .selectFrom("comment")
        .where("id", "=", commentId)
        .select(["authorId"])
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        return await trx
          .deleteFrom("comment")
          .where("id", "=", commentId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to delete this comment");
      }
    });
  } catch (error) {
    throw error;
  }
}
