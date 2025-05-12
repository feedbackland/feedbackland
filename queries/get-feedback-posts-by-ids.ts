"server-only";

import { db } from "@/db/db";

export const getFeedbackPostsByIdsQuery = async ({
  ids,
}: {
  ids: string[];
}) => {
  if (!ids || ids.length === 0) {
    return [];
  }

  try {
    const feedbackPosts = await db
      .selectFrom("feedback")
      .where("id", "in", ids)
      .select([
        "feedback.title",
        "feedback.id",
        "feedback.category",
        "feedback.category",
        "feedback.createdAt",
        "feedback.upvotes",
        "feedback.status",
        (eb) =>
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll<string>().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            // .where("content", "not like", "Updated status to%")
            .as("commentCount"),
      ])
      .execute();

    return feedbackPosts;
  } catch (error: any) {
    console.error("Error in getFeedbackPostsByIdsQuery:", error);

    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to retrieve feedback posts by IDs. Reason: ${reason}`,
    );
  }
};
