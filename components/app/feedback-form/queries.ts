import { db } from "@/db/db";

export async function createFeedback({
  title,
  description,
  userId,
  orgId,
}: {
  title: string;
  description: string;
  userId: string;
  orgId: string;
}) {
  return await db
    .insertInto("feedback")
    .values({
      title,
      description,
      userId,
      orgId,
    })
    .returningAll()
    .executeTakeFirst();
}
