"server-only";

import { db } from "@/db/db";

/**
 * Everything the Ask AI page reads, newest first.
 *
 * Deliberately unfiltered by status. The chat's whole value over the board and
 * over Insights is that any question can be asked of it, and half of the useful
 * ones are about status — what we already shipped that people still ask for,
 * what we declined that keeps coming back. Hiding closed posts would also make
 * every counting question quietly answer against a board the admin cannot see.
 *
 * Descriptions come back as stored HTML and are converted where they are used,
 * so a board larger than the cap does not pay to strip markup from posts that
 * are about to be dropped.
 */
export const getFeedbackCorpusQuery = async ({
  orgId,
  limit,
}: {
  orgId: string;
  limit: number;
}) => {
  try {
    return await db
      .selectFrom("feedback")
      .where("feedback.orgId", "=", orgId)
      .select([
        "feedback.id",
        "feedback.title",
        "feedback.description",
        "feedback.category",
        "feedback.status",
        "feedback.upvotes",
        "feedback.createdAt",
        (eb) =>
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll<string>().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            .as("commentCount"),
      ])
      .orderBy("feedback.createdAt", "desc")
      .limit(limit)
      .execute();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read the feedback posts. Reason: ${reason}`);
  }
};
