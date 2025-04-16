"server-only";

import { db } from "@/db/db";
import pgvector from "pgvector/pg";
import { textEmbeddingModel } from "@/lib/gemini";

export const updateFeedbackPostQuery = async ({
  postId,
  orgId,
  userId,
  title,
  description,
}: {
  postId: string;
  orgId: string;
  userId: string;
  title: string;
  description: string;
}) => {
  try {
    return await db.transaction().execute(async (trx) => {
      const { role } = await trx
        .selectFrom("user_org")
        .select("role")
        .where("userId", "=", userId)
        .where("orgId", "=", orgId)
        .executeTakeFirstOrThrow();

      const { authorId } = await trx
        .selectFrom("feedback")
        .where("id", "=", postId)
        .where("orgId", "=", orgId)
        .select(["authorId"])
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        const embedding = pgvector.toSql(
          (await textEmbeddingModel.embedContent(`${title}: ${description}`))
            .embedding.values,
        );

        return await trx
          .updateTable("feedback")
          .set({ title, description, embedding })
          .where("id", "=", postId)
          .where("orgId", "=", orgId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to update this post");
      }
    });
  } catch (error) {
    throw error;
  }
};
