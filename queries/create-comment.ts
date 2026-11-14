import "server-only";
import { textContent } from "@/lib/utils-server";
import { prepareContent, commitContent } from "./content-write";
export async function createCommentQuery({
  content,
  authorId,
  sessionId,
  postId,
  parentCommentId,
  signal,
}: {
  content: string;
  authorId: string;
  sessionId?: string | null;
  postId: string;
  parentCommentId: string | null;
  signal?: AbortSignal;
}) {
  const text = textContent(content);
  const input = await prepareContent({
    actor: { userId: authorId, sessionId },
    target: { kind: "reply", postId, parentCommentId },
    text: text.plainText,
    imageIds: text.imageIds,
    signal,
  });
  return commitContent(input, "comment", (trx) =>
    trx
      .insertInto("comment")
      .values({
        content: text.content,
        plainText: text.plainText,
        authorId,
        postId,
        parentCommentId,
        revision: "1",
        moderationState: input.coverage.state,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
  );
}
