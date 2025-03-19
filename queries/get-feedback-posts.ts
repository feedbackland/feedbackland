"server-only";

import { db } from "@/db/db";
import { OrderBy } from "@/lib/typings";

export const getFeedbackPostsQuery = async ({
  orgId,
  userId,
  limit,
  cursor,
  orderBy,
}: {
  orgId: string;
  userId: string | null;
  limit: number;
  cursor: string | null | undefined;
  orderBy: OrderBy;
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
      .limit(limit + 1);

    if (orderBy === "newest") {
      query = query.orderBy("feedback.createdAt", "desc");
    }

    if (orderBy === "upvotes") {
      query = query.orderBy("feedback.upvotes", "desc");
    }

    // if (orderBy === 'comments') {
    //   query = query.orderBy("feedback.upvotes", "desc");
    // }

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
