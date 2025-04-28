"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";
import { FeedbackCategory } from "@/lib/typings";

export const getUnseenActivitiesQuery = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  try {
    const feedbackCTE = db
      .selectFrom("feedback")
      .leftJoin("user", "feedback.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .select([
        "feedback.id",
        "feedback.category",
        sql<string>`'post'`.as("type"),
      ]);

    const commentsCTE = db
      .selectFrom("comment")
      .innerJoin("feedback", "comment.postId", "feedback.id")
      .leftJoin("user", "comment.authorId", "user.id")
      .where("feedback.orgId", "=", orgId)
      .select([
        "comment.id",
        sql<FeedbackCategory | null>`null`.as("category"),
        sql<string>`'comment'`.as("type"),
      ]);

    const activityQuery = db.selectFrom(
      feedbackCTE.unionAll(commentsCTE).as("activity"),
    );

    const finalQuery = activityQuery
      .leftJoin("activity_seen", (join) =>
        join
          .onRef("activity.id", "=", "activity_seen.itemId")
          .on("activity_seen.userId", "=", userId),
      )
      .selectAll()
      .select((eb) => [
        eb.fn
          .count("activity.id")
          .filterWhere("activity_seen.userId", "is", null)
          .over()
          .as("unseenItemsCount"),
      ]);

    const unseenItems = await finalQuery.execute();

    const unseenItemsCount = Number(unseenItems?.[0]?.unseenItemsCount || 0);

    return {
      unseenItems,
      unseenItemsCount,
    };
  } catch (error: any) {
    throw error;
  }
};
