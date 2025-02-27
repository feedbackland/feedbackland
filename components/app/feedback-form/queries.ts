import { db } from "@/db/db";

export async function createFeedback({
  title,
  description,
  authorId,
  orgId,
}: {
  title: string;
  description: string;
  authorId: string;
  orgId: string;
}) {
  return await db
    .insertInto("feedback")
    .values({
      title,
      description,
      authorId,
      orgId,
    })
    .returningAll()
    .executeTakeFirst();
}
