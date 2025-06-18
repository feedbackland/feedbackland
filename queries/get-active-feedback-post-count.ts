"server-only";

import { db } from "@/db/db";

export async function getActiveFeedbackPostCountQuery({
  orgId,
}: {
  orgId: string;
}) {
  try {
    const { count } = await db
      .selectFrom("feedback")
      .select(db.fn.count("feedback.id").as("count"))
      .where("feedback.orgId", "=", orgId)
      .where("feedback.status", "!=", "done")
      .where("feedback.status", "!=", "declined")
      .executeTakeFirstOrThrow();

    return Number(count);
  } catch (error) {
    throw error;
  }
}
