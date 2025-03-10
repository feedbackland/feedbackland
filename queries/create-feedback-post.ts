import { db } from "@/db/db";
// import { model } from "@/lib/gemini";

type OpenRouterResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
  error?: {
    // Include error handling
    message: string;
  };
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
    // const type = (
    //   await model.generateContent(
    //     `is this a feature request, bug report or something else? Return either 'feature request', 'bug report' or 'other' (and nothing else, just one of those 3 strings). The text: ${description}`,
    //   )
    // ).response.text();

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
    console.log("data", data);
    const content = data.choices[0]?.message?.content || "";
    console.log("content", content);
    const parsedContent = JSON.parse(content) as {
      title: string;
      category: "feature request" | "bug report" | "other";
    };
    console.log("parsedContent", parsedContent);
    const title = parsedContent.title || "Untitled";
    const type = parsedContent.category || "other";

    return await db
      .insertInto("feedback")
      .values({
        title,
        description,
        type,
        authorId,
        orgId,
      })
      .returningAll()
      .executeTakeFirst();
  } catch (error: any) {
    console.log(error);
    throw error;
  }
}
