import "server-only";
import { replaceImageRefs, validateImages } from "@/lib/images/store";
import { lock, locks } from "@/db/locks";
import { db } from "@/db/db";
import { plainTextContent, feedbackPostHtmlContent } from "@/lib/utils-server";
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
      : feedbackPostHtmlContent(description);
  const title = Array.from(
    text.plainText.match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() ?? text.plainText,
  )
    .slice(0, 80)
    .join("");
  await validateImages(db, text.imageIds);
  return db.transaction().execute(async (trx) => {
    await lock(trx, locks.images);
    const row = await trx
      .insertInto("feedback")
      .values({
        title: title || "Image attachment",
        description: text.content,
        plainText: text.plainText,
        authorId,
        category: "general feedback",
        revision: "1",
        moderationState: "disabled",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await replaceImageRefs(trx, { postId: row.id }, text.imageIds);
    return row;
  });
}
