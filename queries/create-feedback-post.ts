import { db } from "@/db/db";

export async function createFeedbackPostQuery({
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
  try {
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
  } catch (error: any) {
    throw error;
  }
}
