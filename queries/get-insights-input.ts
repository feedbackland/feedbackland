"server-only";

import { db } from "@/db/db";

export const getInsightsInputQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const posts = await db
      .selectFrom("feedback")
      .where("feedback.orgId", "=", orgId)
      .where((eb) =>
        eb.or([
          eb("feedback.status", "is", null),
          eb("feedback.status", "not in", ["done", "declined"]),
        ]),
      )
      .select([
        "feedback.id",
        "feedback.title",
        "feedback.description",
        "feedback.upvotes",
        "feedback.category",
        "feedback.status",
        "feedback.createdAt",
        (eb) =>
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll<string>().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            .as("commentCount"),
      ])
      .orderBy("feedback.createdAt", "desc")
      .execute();

    return posts;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to retrieve feedback posts for insights. Reason: ${reason}`,
    );
  }
};
