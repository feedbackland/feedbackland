"server-only";

import { db } from "@/db/db";
import pgvector from "pgvector/pg";
import { textEmbeddingModel } from "@/lib/gemini";
import { stripHtml } from "@/lib/utils";
import sanitize from "sanitize-html";

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
        const plainTextContent = stripHtml(content);
        const embeddedContent =
          await textEmbeddingModel.embedContent(plainTextContent);
        const vector = embeddedContent.embedding.values;
        const embedding = pgvector.toSql(vector);

        return await trx
          .updateTable("comment")
          .set({ content: sanitize(content), embedding })
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
