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
      .set({ status: status })
      .where("id", "=", postId)
      .where("orgId", "=", orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updatedPost;
  } catch (error) {
    console.error("Error updating feedback post status:", error);
    throw new Error("Failed to update feedback post status");
  }
};
