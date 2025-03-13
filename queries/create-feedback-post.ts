"server-only";

import { db } from "@/db/db";

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
    const prompt = `
    You are an expert at creating concise, natural-sounding titles and categorizing descriptions. 
    Given the following description, create a short title that sounds like it was written by a human.
    Also categorize the description as either 'feature request', 'bug report', or 'other'.
    
    Description:
    ${description}
    
    Respond with a valid JSON object that follows this structure exactly:
    {
      "title": "brief human-like title here",
      "category": "one of: feature request, bug report, or other"
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
          model: "google/gemini-2.0-flash-001",
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
      category: "feature request" | "bug report" | "other";
    };
    const title = parsedContent.title || "Untitled";
    const category = parsedContent.category || "other";

    const feedbackPost = await db
      .insertInto("feedback")
      .values({
        title,
        description,
        category,
        authorId,
        orgId,
      })
      .returningAll()
      .executeTakeFirst();

    return feedbackPost;
  } catch (error: any) {
    console.log(error);
    throw error;
  }
}
