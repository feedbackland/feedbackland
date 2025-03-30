"server-only";

import { db } from "@/db/db";

export const getUserUpvoteQuery = async ({
  userId,
  contentId,
}: {
  userId?: string | null;
  contentId: string;
}) => {
  try {
    if (!userId) return null;

    const result = await db
      .selectFrom("user_upvote")
      .where("user_upvote.userId", "=", userId)
      .where("user_upvote.contentId", "=", contentId)
      .selectAll()
      .executeTakeFirst();

    return result || null;
  } catch (error: any) {
    throw error;
  }
};
