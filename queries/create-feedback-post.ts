import "server-only";
import { db } from "@/db/db";
import { textContent } from "@/lib/utils-server";
export async function createFeedbackPostQuery({
  description,
  authorId,
}: {
  description: string;
  authorId: string | null;
}) {
  const text = textContent(description);
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
