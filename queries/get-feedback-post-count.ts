import "server-only";

import { db } from "@/db/db";

/**
 * How many feedback posts the board holds, counted the same way
 * `getFeedbackCorpusQuery` selects them — every post, whatever its status — so
 * the Ask AI page can say what will be read before anything is asked.
 */
export const getFeedbackPostCountQuery = async () => {
  try {
    const { count } = await db
      .selectFrom("feedback")
      .select(db.fn.count<string>("feedback.id").as("count"))
      .executeTakeFirstOrThrow();

    return Number(count);
  } catch (error) {
    throw new Error("Feedback query failed");
  }
};
