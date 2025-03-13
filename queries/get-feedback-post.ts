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
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.postId")
          .on("user_upvote.userId", "=", userId),
      )
      .where("feedback.id", "=", postId)
      .selectAll("feedback")
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
      .executeTakeFirst();
  } catch (error: any) {
    throw error;
  }
};
