import "server-only";
import { DomainError } from "@/lib/domain-error";
import { deletionImages, deleteOrphans } from "@/lib/images/store";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { authorizeContentWrite, type Actor } from "@/lib/auth/authorization";
export async function deleteFeedbackPostQuery(
  input: Actor & { postId: string },
) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    const admin = await authorizeContentWrite(trx, input);
    await lock(trx, locks.images);
    const row = await trx
      .selectFrom("feedback")
      .select("authorId")
      .where("id", "=", input.postId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (!admin && row.authorId !== input.userId)
      throw new DomainError("FORBIDDEN", "UNAUTHORIZED");
    const ids = await deletionImages(trx, { postId: input.postId });
    const removed = await trx
      .deleteFrom("feedback")
      .where("id", "=", input.postId)
      .returning("id")
      .executeTakeFirstOrThrow();
    await deleteOrphans(trx, ids);
    return removed;
  });
}
