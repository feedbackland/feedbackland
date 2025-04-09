"server-only";

import { db } from "@/db/db";
import { FeedbackStatus } from "@/lib/typings";

export const updateFeedbackPostStatusQuery = async ({
  postId,
  status,
  orgId,
}: {
  postId: string;
  status: FeedbackStatus;
  orgId: string;
}) => {
  try {
    const updatedPost = await db
      .updateTable("feedback")
      .set({ status })
      .where("id", "=", postId)
      .where("orgId", "=", orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updatedPost;
  } catch (error) {
    throw error;
  }
};
