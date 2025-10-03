"server-only";

import { db } from "@/db/db";

export const getCommentsQuery = async ({
  orgId,
  postId,
  userId,
  limit,
  cursor,
}: {
  orgId: string;
  postId: string;
  userId?: string | null;
  limit: number;
  cursor: { id: string; createdAt: string } | null | undefined;
}) => {
  try {
    let query = db
      .selectFrom("comment")
      .leftJoin("user", (join) =>
        join.onRef("comment.authorId", "=", "user.id"),
      )
      .leftJoin("user_org", (join) =>
        join
          .onRef("comment.authorId", "=", "user_org.userId")
          .on("user_org.orgId", "=", orgId),
      )
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("comment.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
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
        "user_org.role as authorRole",
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
      ])
      .where("comment.postId", "=", postId);

    if (cursor) {
      query = query.where("comment.createdAt", "<", new Date(cursor.createdAt));
    }

    query = query.orderBy("comment.createdAt", "desc").limit(limit + 1);

    const comments = await query.execute();

    let nextCursor: typeof cursor | undefined = undefined;

    if (comments.length > limit) {
      const nextItem = comments.pop();

      if (nextItem) {
        nextCursor = {
          id: nextItem?.id,
          createdAt: nextItem.createdAt.toISOString(),
        };
      }
    }

    return {
      comments,
      nextCursor,
    };
  } catch (error) {
    throw error;
  }
};
