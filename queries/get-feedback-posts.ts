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
  cursor: { id: string; createdAt: string } | null | undefined;
  orderBy: OrderBy;
}) => {
  try {
    console.log("cursor", cursor);
    console.log("orderBy", orderBy);

    let query = db
      .selectFrom("feedback")
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId")
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

      if (cursor) {
        query = query.where(
          "feedback.createdAt",
          "<",
          new Date(cursor.createdAt),
        );
      }
    } else if (orderBy === "upvotes") {
      query = query.orderBy("feedback.upvotes", "desc");

      if (cursor) {
        query = query.where("feedback.id", ">", cursor.id);
      }
    }

    const feedbackPosts = await query.execute();

    let nextCursor: typeof cursor | undefined = undefined;

    if (feedbackPosts.length > limit) {
      const nextItem = feedbackPosts.pop();

      if (nextItem) {
        nextCursor = {
          id: nextItem?.id,
          createdAt: nextItem.createdAt.toISOString(),
        };
      }
    }

    return {
      feedbackPosts,
      nextCursor,
    };
  } catch (error: any) {
    throw error;
  }
};
