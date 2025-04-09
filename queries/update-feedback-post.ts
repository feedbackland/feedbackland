import { db } from "@/db/db";

export const updateFeedbackPostQuery = async ({
  postId,
  orgId,
  title,
  description,
}: {
  postId: string;
  orgId: string;
  title: string;
  description: string;
}) => {
  try {
    const updatedPost = await db
      .updateTable("feedback")
      .set({ title, description })
      .where("id", "=", postId)
      .where("orgId", "=", orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updatedPost;
  } catch (error) {
    throw error;
  }
};
