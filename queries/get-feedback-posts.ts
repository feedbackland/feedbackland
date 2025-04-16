"server-only";

import { db } from "@/db/db";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export const getFeedbackPostsQuery = async ({
  orgId,
  userId,
  limit,
  cursor,
  orderBy,
  status,
}: {
  orgId: string;
  userId?: string | null;
  limit: number;
  cursor: { id: string; createdAt: string } | null | undefined;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
}) => {
  try {
    let query = db
      .selectFrom("feedback")
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
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
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
        (eb) =>
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            .as("commentCount"),
      ])
      .limit(limit + 1);

    if (status) {
      query = query.where("feedback.status", "=", status);
    }

    if (orderBy === "newest") {
      query = query.orderBy("feedback.createdAt", "desc");

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb("feedback.createdAt", "<", new Date(cursor.createdAt)),
            eb.and([
              eb("feedback.createdAt", "=", new Date(cursor.createdAt)),
              eb("id", "<", cursor.id),
            ]),
          ]),
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
