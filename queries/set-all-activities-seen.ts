import "server-only";

import { db } from "@/db/db";

export const setAllActivitiesSeenQuery = async ({
  userId,
}: {
  userId: string;
}) => {
  try {
    await db
      .insertInto("activity_seen")
      .columns(["userId", "itemId"])
      .expression((eb) =>
        eb
          .selectFrom("feedback")
          .select([eb.val(userId).as("userId"), "feedback.id as itemId"])
          .union(
            eb
              .selectFrom("comment")
              .innerJoin("feedback", "comment.postId", "feedback.id")
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
