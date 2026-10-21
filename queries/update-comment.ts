import "server-only";
import { DomainError } from "@/lib/domain-error";
import { sql } from "kysely";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { canAdminister, type Actor } from "@/lib/auth/authorization";
import { revision } from "@/lib/revision";
import { textContent } from "@/lib/utils-server";
export async function updateCommentQuery(
  input: Actor & {
    commentId: string;
    content: string;
    expectedRevision: string;
  },
) {
  const text = textContent(input.content);
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    const admin = await canAdminister(trx, input);
    const row = await trx
      .selectFrom("comment")
      .select("authorId")
      .where("id", "=", input.commentId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!admin && row.authorId !== input.userId)
      throw new DomainError("FORBIDDEN", "UNAUTHORIZED");
    const result = await trx
      .updateTable("comment")
      .set({
        content: text.content,
        plainText: text.plainText,
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
        embedding: null,
        embeddingSkipped: false,
        moderationState: "disabled",
      })
      .where("id", "=", input.commentId)
      .where("revision", "=", revision(input.expectedRevision))
      .returningAll()
      .executeTakeFirst();
    if (!result) throw new DomainError("CONFLICT", "CONFLICT");
    return result;
  });
}
