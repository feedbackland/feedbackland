import "server-only";
import { sql } from "kysely";
import type { Actor } from "@/lib/auth/authorization";
import { textContent } from "@/lib/utils-server";
import { prepareContent, commitContent } from "./content-write";
export async function updateCommentQuery(
  input: Actor & {
    commentId: string;
    content: string;
    expectedRevision: string;
    signal?: AbortSignal;
  },
) {
  const text = textContent(input.content);
  const write = await prepareContent({
    actor: input,
    target: {
      kind: "edit",
      table: "comment",
      id: input.commentId,
      expectedRevision: input.expectedRevision,
    },
    text: text.plainText,
    imageIds: text.imageIds,
    signal: input.signal,
  });
  return commitContent(write, "comment", (trx) =>
    trx
      .updateTable("comment")
      .set({
        content: text.content,
        plainText: text.plainText,
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
        embedding: null,
        embeddingSkipped: false,
        moderationState: write.coverage.state,
      })
      .where("id", "=", input.commentId)
      .where("revision", "=", input.expectedRevision)
      .returningAll()
      .executeTakeFirstOrThrow(),
  );
}
