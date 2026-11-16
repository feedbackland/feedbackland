import "server-only";
import { plainTextContent, feedbackPostHtmlContent } from "@/lib/utils-server";
import { prepareContent, commitContent } from "./content-write";

export async function createFeedbackPostQuery({
  description,
  authorId,
  sessionId,
  descriptionFormat = "html",
  signal,
}: {
  description: string;
  authorId: string | null;
  sessionId: string | null | undefined;
  descriptionFormat?: "html" | "plain-text";
  signal?: AbortSignal;
}) {
  const text =
    descriptionFormat === "plain-text"
      ? plainTextContent(description)
      : feedbackPostHtmlContent(description);
  const input = await prepareContent({
    actor: authorId === null ? null : { userId: authorId, sessionId },
    target: { kind: "new-post" },
    text: text.plainText,
    imageIds: text.imageIds,
    signal,
  });
  return commitContent(input, "post", (trx) =>
    trx
      .insertInto("feedback")
      .values({
        ...input.labels,
        description: text.content,
        plainText: text.plainText,
        authorId,
        revision: "1",
        moderationState: input.coverage.state,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
  );
}
