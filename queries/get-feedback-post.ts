"server-only";

import { db } from "@/db/db";

export const getFeedbackPost = async ({
  postId,
  userId,
}: {
  postId: string;
  userId: string | null;
}) => {
  try {
    return await db
      .selectFrom("feedback")
      .leftJoin("user", (join) =>
        join.onRef("feedback.authorId", "=", "user.id"),
      )
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId),
      )
      .where("feedback.id", "=", postId)
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
        "user.name as authorName",
        "user.photoURL as authorPhotoURL",
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId)
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
      .executeTakeFirst();
  } catch (error: any) {
    throw error;
  }
};
