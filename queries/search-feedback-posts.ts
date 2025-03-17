"server-only";

import { db } from "@/db/db";
import { textEmbeddingModel } from "@/lib/gemini";
import { cosineDistance } from "pgvector/kysely";

export const searchFeedbackPostsQuery = async ({
  orgId,
  searchValue,
}: {
  orgId: string;
  searchValue: string;
}) => {
  const {
    embedding: { values },
  } = await textEmbeddingModel.embedContent(searchValue);

  const distance = cosineDistance("embedding", values);

  const results = await db
    .selectFrom("feedback")
    .select(["id", "title", "description", "createdAt"])
    .select([() => distance.as("distance")])
    .where("orgId", "=", orgId)
    .where(distance, "<", 0.5)
    .orderBy(distance)
    .limit(10)
    .execute();

  return results;
};
