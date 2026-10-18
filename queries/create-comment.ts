import "server-only";
import { db } from "@/db/db";
import { textContent } from "@/lib/utils-server";
import { validateReplyParent } from "./reply-parent";
export async function createCommentQuery({
  content,
  authorId,
  postId,
  parentCommentId,
}: {
  content: string;
  authorId: string;
  postId: string;
  parentCommentId: string | null;
}) {
  const text = textContent(content);
  await validateReplyParent(db, postId, parentCommentId);
  return db.transaction().execute(async (trx) => {
    await trx
      .selectFrom("feedback")
      .select("id")
      .where("id", "=", postId)
      .forKeyShare()
      .executeTakeFirstOrThrow();
    await validateReplyParent(trx, postId, parentCommentId);
    return trx
      .insertInto("comment")
      .values({
        content: text.content,
        plainText: text.plainText,
        authorId,
        postId,
        parentCommentId,
        revision: "1",
        moderationState: "disabled",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}
