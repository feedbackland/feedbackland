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
  cursor: { id: string; createdAt: string } | null | undefined;
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
            .when("user_upvote.userId", "=", userId)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
      ])
      .orderBy("comment.createdAt", "desc")
      .limit(limit + 1);

    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb("comment.createdAt", "<", new Date(cursor.createdAt)),
          eb.and([
            eb("comment.createdAt", "=", new Date(cursor.createdAt)),
            eb("id", "<", cursor.id),
          ]),
        ]),
      );

      // query = query.where(
      //   "comment.createdAt",
      //   "<",
      //   new Date(cursor.createdAt),
      // );
    }

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
  } catch (error: any) {
    throw error;
  }
};
