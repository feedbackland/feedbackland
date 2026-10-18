import "server-only";
import { db } from "@/db/db";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
import type { FeedbackStatus } from "@/lib/typings";
export async function updateFeedbackPostStatusQuery(
  input: Actor & { postId: string; status: FeedbackStatus },
) {
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input);
    return trx
      .updateTable("feedback")
      .set({ status: input.status })
      .where("id", "=", input.postId)
      .returning(["id", "status"])
      .executeTakeFirstOrThrow();
  });
}
