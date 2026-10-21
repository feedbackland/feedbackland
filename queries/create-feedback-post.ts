import "server-only";
import { db } from "@/db/db";
import { plainTextContent, textContent } from "@/lib/utils-server";
export async function createFeedbackPostQuery({
  description,
  authorId,
  descriptionFormat = "html",
}: {
  description: string;
  authorId: string | null;
  descriptionFormat?: "html" | "plain-text";
}) {
  const text =
    descriptionFormat === "plain-text"
      ? plainTextContent(description)
      : textContent(description);
  const title = Array.from(
    text.plainText.match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() ?? text.plainText,
  )
    .slice(0, 80)
    .join("");
  return db
    .insertInto("feedback")
    .values({
      title,
      description: text.content,
      plainText: text.plainText,
      authorId,
      category: "general feedback",
      revision: "1",
      moderationState: "disabled",
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
