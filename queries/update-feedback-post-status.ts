"server-only";

import { db } from "@/db/db";
import { FeedbackStatus } from "@/lib/typings";

export const updateFeedbackPostStatusQuery = async ({
  postId,
  status,
  userId,
  orgId,
}: {
  postId: string;
  status: FeedbackStatus;
  userId: string;
  orgId: string;
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
          .set({ status })
          .where("id", "=", postId)
          .where("orgId", "=", orgId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error(
          "Not authorized to change the status of this feedback post",
        );
      }
    });
  } catch (error) {
    throw error;
  }
};
