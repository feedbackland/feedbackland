import "server-only";
import { DomainError } from "@/lib/domain-error";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { canAdminister, type Actor } from "@/lib/auth/authorization";
export async function deleteFeedbackPostQuery(
  input: Actor & { postId: string },
) {
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
      throw new DomainError("FORBIDDEN", "UNAUTHORIZED");
    return trx
      .deleteFrom("feedback")
      .where("id", "=", input.postId)
      .returning("id")
      .executeTakeFirstOrThrow();
  });
}
