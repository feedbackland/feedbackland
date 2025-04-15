"server-only";

import { db } from "@/db/db";
import { textEmbeddingModel } from "@/lib/gemini";
import { FeedbackCategory } from "@/lib/typings";
import pgvector from "pgvector/pg";

const getTitleAndCategory = async (description: string) => {
  const prompt = `
    You are an expert at creating concise, natural-sounding titles and categorizing descriptions.
    Given the following description, create a short title that sounds like it was written by a human.
    Also categorize the description as either a 'feature request', 'bug report' or 'general feedback'.

    Description:
    ${description}

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
        // model: "google/gemini-2.0-flash-001",
        model: "google/gemini-2.0-flash-lite-001",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 150,
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

const getEmbedding = async (description: string) => {
  const result = await textEmbeddingModel.embedContent(description);
  return result.embedding.values;
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
    const { title, category } = await getTitleAndCategory(description);

    const embedding = pgvector.toSql(
      await getEmbedding(`${title}: ${description}`),
    );

    const feedbackPost = await db
      .insertInto("feedback")
      .values({
        title,
        description,
        category,
        authorId,
        orgId,
        embedding,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return feedbackPost;
  } catch (error: any) {
    console.log(error);
    throw error;
  }
}
