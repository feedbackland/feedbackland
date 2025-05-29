"server-only";

import { db } from "@/db/db";

export const setAllActivitiesSeenQuery = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  try {
    const feedbackIds = await db
      .selectFrom("feedback")
      .where("orgId", "=", orgId)
      .select(["feedback.id"])
      .execute();

    const commentIds = await db
      .selectFrom("comment")
      .innerJoin("feedback", "comment.postId", "feedback.id")
      .where("feedback.orgId", "=", orgId)
      .select(["comment.id"])
      .execute();

    const allItemIds = [
      ...feedbackIds.map((f) => f.id),
      ...commentIds.map((c) => c.id),
    ];

    if (allItemIds.length === 0) {
      return true;
    }

    const valuesToInsert = allItemIds.map((itemId) => ({
      userId,
      itemId,
    }));

    await db
      .insertInto("activity_seen")
      .values(valuesToInsert)
      .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
      .execute();

    return true;
  } catch (error) {
    throw error;
  }
};
