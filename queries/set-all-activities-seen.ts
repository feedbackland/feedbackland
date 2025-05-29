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
    await db
      .insertInto("activity_seen")
      .columns(["userId", "itemId"])
      .expression((eb) =>
        eb
          .selectFrom("feedback")
          .where("orgId", "=", orgId)
          .select([eb.val(userId).as("userId"), "feedback.id as itemId"])
          .unionAll(
            eb
              .selectFrom("comment")
              .innerJoin("feedback", "comment.postId", "feedback.id")
              .where("feedback.orgId", "=", orgId)
              .select([eb.val(userId).as("userId"), "comment.id as itemId"]),
          ),
      )
      .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
      .execute();

    return true;
  } catch (error) {
    throw error;
  }
};
