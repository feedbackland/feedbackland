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
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit + 1);

    // Apply the cursor filter if we have one
    if (cursor) {
      query = query.where("createdAt", "<", new Date(cursor));
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
