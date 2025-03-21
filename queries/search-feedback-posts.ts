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
  userId: string | null;
  searchValue: string;
}) => {
  const {
    embedding: { values },
  } = await textEmbeddingModel.embedContent(searchValue);

  const distance = cosineDistance("embedding", values);

  const results = db
    .selectFrom("feedback")
    .leftJoin("user_upvote", (join) =>
      join
        .onRef("feedback.id", "=", "user_upvote.contentId")
        .on("user_upvote.userId", "=", userId),
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
    ])
    .select([
      (eb) =>
        eb
          .case()
          .when("user_upvote.userId", "=", userId)
          .then(true)
          .else(false)
          .end()
          .as("hasUserUpvote"),
    ])
    .select([() => distance.as("distance")])
    .where(distance, "<", 0.5)
    .orderBy(distance)
    .limit(10)
    .execute();

  return results;
};
