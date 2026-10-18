import "server-only";
import { sql } from "kysely";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { canAdminister, type Actor } from "@/lib/auth/authorization";
import { revision } from "@/lib/revision";
import { textContent } from "@/lib/utils-server";
export async function updateFeedbackPostQuery(
  input: Actor & {
    postId: string;
    title: string;
    description: string;
    expectedRevision: string;
  },
) {
  const text = textContent(input.description);
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    const admin = await canAdminister(trx, input);
    const row = await trx
      .selectFrom("feedback")
      .select("authorId")
      .where("id", "=", input.postId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!admin && row.authorId !== input.userId)
      throw new Error("UNAUTHORIZED");
    const result = await trx
      .updateTable("feedback")
      .set({
        title: input.title,
        description: text.content,
        plainText: text.plainText,
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
        embedding: null,
        embeddingSkipped: false,
        moderationState: "disabled",
      })
      .where("id", "=", input.postId)
      .where("revision", "=", revision(input.expectedRevision))
      .returningAll()
      .executeTakeFirst();
    if (!result) throw new Error("CONFLICT");
    return result;
  });
}
