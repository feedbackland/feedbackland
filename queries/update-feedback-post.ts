import "server-only";
import { sql } from "kysely";
import type { Actor } from "@/lib/auth/authorization";
import { feedbackPostHtmlContent } from "@/lib/utils-server";
import { prepareContent, commitContent } from "./content-write";
export async function updateFeedbackPostQuery(
  input: Actor & {
    postId: string;
    title: string;
    description: string;
    expectedRevision: string;
    signal?: AbortSignal;
  },
) {
  const text = feedbackPostHtmlContent(input.description);
  const write = await prepareContent({
    actor: input,
    target: {
      kind: "edit",
      table: "feedback",
      id: input.postId,
      expectedRevision: input.expectedRevision,
    },
    text: [input.title, text.plainText].join("\n"),
    imageIds: text.imageIds,
    signal: input.signal,
  });
  return commitContent(write, "post", (trx) =>
    trx
      .updateTable("feedback")
      .set({
        title: input.title,
        description: text.content,
        plainText: text.plainText,
        revision: sql`revision+1`,
        updatedAt: sql`clock_timestamp()`,
        embedding: null,
        embeddingSkipped: false,
        moderationState: write.coverage.state,
      })
      .where("id", "=", input.postId)
      .where("revision", "=", input.expectedRevision)
      .returningAll()
      .executeTakeFirstOrThrow(),
  );
}
