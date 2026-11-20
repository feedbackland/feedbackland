import "server-only";

import { sql } from "kysely";
import { db } from "@/db/db";
import { ASK_AI_MAX_DESCRIPTION_CHARS } from "@/lib/ask-ai";

/** Include every status. The selected records and their text are bounded at the query. */
export function getFeedbackCorpusQuery(
  { limit }: { limit: number },
  connection = db,
) {
  return connection
    .selectFrom("feedback")
    .select([
      "feedback.id",
      sql<string>`left(feedback.title, 300)`.as("title"),
      sql<string>`left(feedback."plainText", ${ASK_AI_MAX_DESCRIPTION_CHARS})`.as(
        "plainText",
      ),
      "feedback.category",
      "feedback.status",
      "feedback.upvotes",
      "feedback.createdAt",
      (eb) =>
        eb
          .selectFrom("comment")
          .select(eb.fn.countAll<string>().as("commentCount"))
          .whereRef("comment.postId", "=", "feedback.id")
          .as("commentCount"),
    ])
    .orderBy("feedback.createdAt", "desc")
    .orderBy("feedback.id", "asc")
    .limit(limit);
}
