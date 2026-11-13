import "server-only";
import { DomainError } from "@/lib/domain-error";
import { deletionImages, deleteOrphans } from "@/lib/images/store";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { authorizeContentWrite, type Actor } from "@/lib/auth/authorization";
export async function deleteCommentQuery(input: Actor & { commentId: string }) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    const admin = await authorizeContentWrite(trx, input);
    await lock(trx, locks.images);
    const row = await trx
      .selectFrom("comment")
      .select("authorId")
      .where("id", "=", input.commentId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!admin && row.authorId !== input.userId)
      throw new DomainError("FORBIDDEN", "UNAUTHORIZED");
    const ids = await deletionImages(trx, { commentId: input.commentId });
    const removed = await trx
      .deleteFrom("comment")
      .where("id", "=", input.commentId)
      .returning("id")
      .executeTakeFirstOrThrow();
    await deleteOrphans(trx, ids);
    return removed;
  });
}
