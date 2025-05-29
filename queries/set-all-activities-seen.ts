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
      .with("all_items", (db) =>
        db
          .selectFrom("feedback")
          .where("orgId", "=", orgId)
          .select(["feedback.id"])
          .union(
            db
              .selectFrom("comment")
              .innerJoin("feedback", "comment.postId", "feedback.id")
              .where("feedback.orgId", "=", orgId)
              .select(["comment.id"]),
          ),
      )
      .insertInto("activity_seen")
      .columns(["userId", "itemId"])
      .expression((eb) =>
        eb
          .selectFrom("all_items")
          .select([eb.val(userId).as("userId"), "all_items.id as itemId"]),
      )
      .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
      .execute();

    return true;

    // // Insert feedback IDs into activity_seen
    // await db
    //   .insertInto("activity_seen")
    //   .columns(["userId", "itemId"])
    //   .expression((eb) =>
    //     eb
    //       .selectFrom("feedback")
    //       .select((subEb) => [
    //         subEb.val(userId).as("userId"),
    //         "feedback.id as itemId",
    //       ])
    //       .where("feedback.orgId", "=", orgId)
    //       .where((eb) =>
    //         eb.not(
    //           eb.exists(
    //             db
    //               .selectFrom("activity_seen as seen")
    //               .select("seen.itemId")
    //               .whereRef("seen.itemId", "=", eb.ref("feedback.id"))
    //               .where("seen.userId", "=", userId),
    //           ),
    //         ),
    //       ),
    //   )
    //   .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
    //   .execute();

    // // Insert comment IDs into activity_seen
    // await db
    //   .insertInto("activity_seen")
    //   .columns(["userId", "itemId"])
    //   .expression((eb) =>
    //     eb
    //       .selectFrom("comment")
    //       .innerJoin("feedback", "comment.postId", "feedback.id")
    //       .select((subEb) => [
    //         subEb.val(userId).as("userId"),
    //         "comment.id as itemId",
    //       ])
    //       .where("feedback.orgId", "=", orgId)
    //       .where((eb) =>
    //         eb.not(
    //           eb.exists(
    //             db
    //               .selectFrom("activity_seen as seen")
    //               .select("seen.itemId")
    //               .whereRef("seen.itemId", "=", eb.ref("comment.id"))
    //               .where("seen.userId", "=", userId),
    //           ),
    //         ),
    //       ),
    //   )
    //   .onConflict((oc) => oc.columns(["userId", "itemId"]).doNothing())
    //   .execute();

    // return true;
  } catch (error) {
    throw error;
  }
};
