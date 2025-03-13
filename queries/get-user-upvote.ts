"server-only";

import { db } from "@/db/db";

export const getUserUpvoteQuery = async ({
  userId,
  postId,
}: {
  userId: string;
  postId: string;
}) => {
  try {
    const result = await db
      .selectFrom("user_upvote")
      .where("user_upvote.userId", "=", userId)
      .where("user_upvote.postId", "=", postId)
      .selectAll()
      .executeTakeFirst();
    return result || null;
  } catch (error: any) {
    throw error;
  }
};
