"server-only";

import { db } from "@/db/db";

export async function getActivePostCountQuery({ orgId }: { orgId: string }) {
  try {
    const { count } = await db
      .selectFrom("feedback")
      .select(db.fn.count("feedback.id").as("count"))
      .where("feedback.orgId", "=", orgId)
      .where((eb) =>
        eb.or([
          eb("feedback.status", "is", null),
          eb("feedback.status", "not in", ["done", "declined"]),
        ]),
      )
      .executeTakeFirstOrThrow();

    return Number(count);
  } catch (error) {
    throw error;
  }
}
