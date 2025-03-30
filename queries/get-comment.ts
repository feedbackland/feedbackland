"server-only";

import { db } from "@/db/db";

export const getCommentQuery = async ({
  commentId,
  userId,
}: {
  commentId: string;
  userId?: string | null;
}) => {
  try {
    return await db
      .selectFrom("comment")
      .leftJoin("user", (join) =>
        join.onRef("comment.authorId", "=", "user.id"),
      )
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("comment.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
      .where("comment.id", "=", commentId)
      .select([
        "comment.id",
        "comment.parentCommentId",
        "comment.postId",
        "comment.createdAt",
        "comment.updatedAt",
        "comment.authorId",
        "comment.content",
        "comment.upvotes",
        "user.name as authorName",
        "user.photoURL as authorPhotoURL",
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
      ])
      .executeTakeFirstOrThrow();
  } catch (error: any) {
    throw error;
  }
};
