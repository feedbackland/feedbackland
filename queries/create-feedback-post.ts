"server-only";

import { db } from "@/db/db";
import { FeedbackCategory } from "@/lib/typings";
import { clean, getPlainText } from "@/lib/utils";
import { generateEmbedding } from "@/lib/utils-server";

const getTitleAndCategory = async (plainTextDescription: string) => {
  const prompt = `
    You are an expert at creating concise, natural-sounding titles and categorizing descriptions.
    Given the following description, create a short title that sounds like it was written by a human.
    Also categorize the description as either a 'feature request', 'bug report' or 'general feedback'.

    Description:
    ${plainTextDescription}

    Respond with a valid JSON object that follows this structure exactly:
    {
      "title": "brief human-like title here",
      "category": "one of: feature request, bug report, general feedback"
    }
  `;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite-preview-06-17",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  const data = await response.json();

  const content = data.choices[0]?.message?.content || "";

  const parsedContent = JSON.parse(content) as {
    title: string;
    category: FeedbackCategory;
  };

  const { title, category } = parsedContent;

  return { title, category };
};

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
    const plainTextDescription = getPlainText(description);
    const { title, category } = await getTitleAndCategory(plainTextDescription);
    const embedding = await generateEmbedding(
      `${title}: ${plainTextDescription}`,
    );

    const feedbackPost = await db
      .insertInto("feedback")
      .values({
        title,
        description: clean(description),
        category,
        authorId,
        orgId,
        embedding,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return feedbackPost;
  } catch (error: any) {
    throw error;
  }
}
