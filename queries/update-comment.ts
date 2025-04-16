"server-only";

import { db } from "@/db/db";
import pgvector from "pgvector/pg";
import { textEmbeddingModel } from "@/lib/gemini";

export const updateCommentQuery = async ({
  commentId,
  orgId,
  userId,
  content,
}: {
  commentId: string;
  orgId: string;
  userId: string;
  content: string;
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
        .selectFrom("comment")
        .where("id", "=", commentId)
        .select(["authorId"])
        .executeTakeFirstOrThrow();

      if (role === "admin" || authorId === userId) {
        const embedding = pgvector.toSql(
          (await textEmbeddingModel.embedContent(content)).embedding.values,
        );

        return await trx
          .updateTable("comment")
          .set({ content, embedding })
          .where("id", "=", commentId)
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        throw new Error("Not authorized to update this comment");
      }
    });
  } catch (error) {
    throw error;
  }
};
