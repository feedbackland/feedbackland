import "server-only";

import { db } from "@/db/db";

/**
 * Scoped to the board, not just to the ids. Both callers resolve ids that came
 * out of a model — the posts behind an insight, and the posts an Ask AI answer
 * cites — and an id is only ever meant to name a post on the board being looked
 * at. Filtering on the primary key is what makes a made-up id resolve to nothing rather
 * than to some other board's post.
 */
export const getFeedbackPostsByIdsQuery = async ({
  ids,
}: {
  ids: string[];
}) => {
  if (!ids || ids.length === 0) {
    return [];
  }

  try {
    const feedbackPosts = await db
      .selectFrom("feedback")
      .where("id", "in", ids)
      .select([
        "feedback.title",
        "feedback.id",
        "feedback.category",
        "feedback.category",
        "feedback.createdAt",
        "feedback.upvotes",
        "feedback.status",
        (eb) =>
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            .as("commentCount"),
      ])
      .execute();

    return feedbackPosts;
  } catch (error) {
    throw new Error("Feedback query failed");
  }
};
