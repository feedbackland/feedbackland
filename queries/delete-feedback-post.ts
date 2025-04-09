"server-only";

import { db } from "@/db/db";

export async function deleteFeedbackPostQuery({
  postId,
  userId,
  orgId,
}: {
  postId: string;
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
        .selectFrom("feedback")
        .where("id", "=", postId)
        .select(["authorId"])
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        return await trx
          .deleteFrom("feedback")
          .where("id", "=", postId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to delete this post");
      }
    });
  } catch (error) {
    throw error;
  }
}
