import "server-only";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { canAdminister, type Actor } from "@/lib/auth/authorization";
export async function deleteCommentQuery(input: Actor & { commentId: string }) {
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
      throw new Error("UNAUTHORIZED");
    return trx
      .deleteFrom("comment")
      .where("id", "=", input.commentId)
      .returning("id")
      .executeTakeFirstOrThrow();
  });
}
