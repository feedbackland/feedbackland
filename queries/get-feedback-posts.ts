"server-only";

import { db } from "@/db/db";

export const getFeedbackPostsQuery = async ({
  orgId,
  userId,
  limit,
  cursor,
}: {
  orgId: string;
  userId: string | null;
  limit: number;
  cursor: string | null | undefined;
}) => {
  try {
    let query = db
      .selectFrom("feedback")
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.postId")
          .on("user_upvote.userId", "=", userId),
      )
      .where("feedback.orgId", "=", orgId)
      .select([
        "feedback.id",
        "feedback.createdAt",
        "feedback.updatedAt",
        "feedback.orgId",
        "feedback.authorId",
        "feedback.category",
        "feedback.title",
        "feedback.description",
        "feedback.upvotes",
      ])
      .select([
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
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
