"server-only";

import { db } from "@/db/db";

export const getInsightsInputQuery = async ({ orgId }: { orgId: string }) => {
  try {
    const posts = await db
      .selectFrom("feedback")
      .where("feedback.orgId", "=", orgId)
      .where((eb) =>
        eb.or([
          eb("status", "not in", ["done", "declined", "in progress"]),
          eb("status", "is", null),
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
            // .where("content", "not like", "Updated status to%")
            .as("commentCount"),
      ])
      .orderBy("feedback.createdAt", "desc")
      .execute();

    return posts;
  } catch (error: any) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Failed to retrieve feedback posts for insights. Reason: ${reason}`,
    );
  }
};
