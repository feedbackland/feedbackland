import "server-only";
import { contentTransaction } from "@/db/content-transaction";
import { lock, locks } from "@/db/locks";
import { requireAdmin, type Actor } from "@/lib/auth/authorization";
import type { FeedbackStatus } from "@/lib/typings";
export async function updateFeedbackPostStatusQuery(
  input: Actor & {
    postId: string;
    status: FeedbackStatus;
    signal?: AbortSignal;
  },
) {
  return contentTransaction(input.signal, async (trx) => {
    await lock(trx, locks.membership);
    await requireAdmin(trx, input, true);
    const previous = await trx
      .selectFrom("feedback")
      .select(["id", "status"])
      .where("id", "=", input.postId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    if (previous.status === input.status) {
      await requireAdmin(trx, input);
      return previous;
    }
    const post = await trx
      .updateTable("feedback")
      .set({ status: input.status })
      .where("id", "=", input.postId)
      .returning(["id", "status"])
      .executeTakeFirstOrThrow();
    // Status history contains only a validated enum and the database's post id.
    const label = post.status ?? "none";
    const content = post.status
      ? `Updated status to <span data-type="status" data-id="${post.id}" data-label="${label.replace(" ", "-")}">${label}</span>`
      : "Updated status to none";
    await trx
      .insertInto("comment")
      .values({
        postId: post.id,
        authorId: input.userId,
        content,
        plainText: "Updated status to " + label,
        revision: "1",
        moderationState: "disabled",
      })
      .execute();
    await requireAdmin(trx, input);
    return post;
  });
}
