"server-only";

import { db } from "@/db/db";
import { FeedbackCategory } from "@/lib/typings";
import { clean, getPlainText } from "@/lib/utils";
import { generateEmbedding } from "@/lib/utils-server";
import { parse, HTMLElement } from "node-html-parser";

const getImageUrls = (htmlContent: string) => {
  const root = parse(htmlContent);

  const imageElements: HTMLElement[] = root.querySelectorAll("img");

  const imageUrls = imageElements
    .map((imgElement) => imgElement.getAttribute("src"))
    .filter((src): src is string => !!src);

  return imageUrls;
};

const getTitleAndCategory = async ({
  plainTextDescription,
}: {
  plainTextDescription: string;
}) => {
  try {
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
          model: "google/gemini-2.5-flash-lite",
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
  } catch (error) {
    throw error;
  }
};

const isInappropriateCheck = async ({
  plainTextDescription,
  imageUrls,
}: {
  plainTextDescription: string;
  imageUrls: string[];
}) => {
  try {
    const prompt = `
      You are a strict content moderator. Analyze the provided text and images (via URLs) for inappropriate content including violence, sexual material, hate speech, harassment, illegal activities, or anything harmful/unsafe.

      Respond ONLY with a JSON object in this exact format:
      \`\`\`json
      {
        "isInappropriate": boolean, // true being inappropriate, false being safe
        "confidenceScore": number // 0.0 to 1.0, where 1.0 is very confident
      }
      \`\`\`

      For example:
      {
        "isInappropriate": true,
        "confidenceScore": 0.9
      }
    `;

    const messages: any = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "text", text: `User Text: "${plainTextDescription}"` },
        ],
      },
    ];

    imageUrls.forEach((url) => {
      messages[0].content.push({
        type: "image_url",
        image_url: { url },
      });
    });

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages,
          response_format: { type: "json_object" },
        }),
      },
    );

    const data = await response.json();

    const content = data.choices[0]?.message?.content;

    if (!content) {
      return { isInappropriate: true, confidenceScore: 1.0 };
    }

    const parsedContent = JSON.parse(content) as {
      isInappropriate: boolean;
      confidenceScore: number;
    };

    const { isInappropriate, confidenceScore } = parsedContent;

    return { isInappropriate, confidenceScore };
  } catch (error) {
    throw error;
  }
};

export async function createFeedbackPostQuery({
  description,
  authorId,
  orgId,
}: {
  description: string;
  authorId: string | null;
  orgId: string;
}) {
  try {
    const imageUrls = getImageUrls(description);
    const plainTextDescription = getPlainText(description);

    const [{ isInappropriate, confidenceScore }, { title, category }] =
      await Promise.all([
        isInappropriateCheck({
          plainTextDescription,
          imageUrls,
        }),
        getTitleAndCategory({
          plainTextDescription,
        }),
      ]);

    if (isInappropriate && confidenceScore > 0.7) {
      throw new Error("inappropriate-content");
    }

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
  } catch (error) {
    throw error;
  }
}
