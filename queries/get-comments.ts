"server-only";

import { db } from "@/db/db";

export const getCommentsQuery = async ({
  postId,
  userId,
  limit,
  cursor,
}: {
  postId: string;
  userId: string | null;
  limit: number;
  cursor: string | null | undefined;
}) => {
  try {
    let query = db
      .selectFrom("comment")
      .leftJoin("user", (join) =>
        join.onRef("comment.authorId", "=", "user.id"),
      )
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("comment.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId),
      )
      .where("comment.postId", "=", postId)
      .select([
        "comment.id",
        "comment.createdAt",
        "comment.updatedAt",
        "comment.authorId",
        "comment.content",
        "comment.upvotes",
        "user.name as authorName",
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
      .orderBy("comment.createdAt", "desc")
      .limit(limit + 1);

    if (cursor) {
      query = query.where("comment.createdAt", "<", new Date(cursor));
    }

    const comments = await query.execute();

    const nextCursor =
      comments.length > 0
        ? comments[comments.length - 1].createdAt.toISOString()
        : null;

    return {
      comments,
      nextCursor,
    };
  } catch (error: any) {
    throw error;
  }
};
