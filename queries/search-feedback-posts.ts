"server-only";

import { db } from "@/db/db";
import { textEmbeddingModel } from "@/lib/gemini";
import { cosineDistance } from "pgvector/kysely";

export const searchFeedbackPostsQuery = async ({
  orgId,
  userId,
  searchValue,
}: {
  orgId: string;
  userId?: string | null;
  searchValue: string;
}) => {
  try {
    const {
      embedding: { values },
    } = await textEmbeddingModel.embedContent(searchValue);

    const distance = cosineDistance("embedding", values);

    const results = await db
      .selectFrom("feedback")
      .leftJoin("user_upvote", (join) =>
        join
          .onRef("feedback.id", "=", "user_upvote.contentId")
          .on("user_upvote.userId", "=", userId || null),
      )
      .where("feedback.orgId", "=", orgId)
      .select([
        "feedback.id",
        "feedback.createdAt",
        "feedback.updatedAt",
        "feedback.orgId",
        "feedback.authorId",
        "feedback.category",
        "feedback.title",
        "feedback.description",
        "feedback.upvotes",
        (eb) =>
          eb
            .case()
            .when("user_upvote.userId", "=", userId || null)
            .then(true)
            .else(false)
            .end()
            .as("hasUserUpvote"),
        (eb) =>
          eb
            .selectFrom("comment")
            .select(eb.fn.countAll().as("commentCount"))
            .whereRef("comment.postId", "=", "feedback.id")
            .as("commentCount"),
      ])
      .where(distance, "<", 0.4)
      .orderBy(distance)
      .limit(50)
      .executeTakeFirstOrThrow();

    return results;
  } catch (error) {
    throw error;
  }
};
