import { db } from "@/db/db";
import { model } from "@/lib/gemini";

export async function createFeedbackPostQuery({
  description,
  authorId,
  orgId,
}: {
  description: string;
  authorId: string;
  orgId: string;
}) {
  try {
    const prompt = `Generate an appropriate title for the following text and make it sound like it was written by a human. Keep the title short and concise, and avoid using punctuations. Return one title only, and nothing else. The text for which a title should be generated: ${description}`;
    const result = await model.generateContent(prompt);
    const title = result.response.text();

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
