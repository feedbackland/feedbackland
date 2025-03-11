"server-only";

import { db } from "@/db/db";

export const getFeedbackPostsQuery = async ({
  limit,
  cursor,
}: {
  limit: number;
  cursor: string | null | undefined;
}) => {
  try {
    let query = db
      .selectFrom("feedback")
      .innerJoin("user", "feedback.authorId", "user.id")
      .select([
        "feedback.id",
        "feedback.createdAt",
        "feedback.updatedAt",
        "feedback.orgId",
        "feedback.authorId",
        "feedback.category",
        "feedback.title",
        "feedback.description",
        "user.name as authorName",
      ])
      .orderBy("feedback.createdAt", "desc")
      .limit(limit + 1);

    // Apply the cursor filter if we have one
    if (cursor) {
      query = query.where("feedback.createdAt", "<", new Date(cursor));
    }

    const feedbackPosts = await query.execute();

    const nextCursor =
      feedbackPosts.length > 0
        ? feedbackPosts[feedbackPosts.length - 1].createdAt.toISOString()
        : null;

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error: any) {
    throw error;
  }
};
