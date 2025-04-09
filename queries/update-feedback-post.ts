"server-only";

import { db } from "@/db/db";

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
        .executeTakeFirstOrThrow();

      const { authorId } = await trx
        .selectFrom("feedback")
        .where("id", "=", postId)
        .where("orgId", "=", orgId)
        .select(["authorId"])
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        return await trx
          .updateTable("feedback")
          .set({ title, description })
          .where("id", "=", postId)
          .where("orgId", "=", orgId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to delete this post");
      }
    });
  } catch (error) {
    throw error;
  }
};
