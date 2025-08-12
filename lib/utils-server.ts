import { gemini } from "@/lib/gemini";
import pgvector from "pgvector/pg";
import { parse, HTMLElement } from "node-html-parser";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";
import { getSubscriptionQuery } from "@/queries/get-subscription";

export const generateVector = async (text: string) => {
  try {
    const response = await gemini.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    });

    return response?.embeddings?.[0]?.values;
  } catch {
    throw new Error("Failed to generate vector");
  }
};

export const generateEmbedding = async (text: string) => {
  try {
    const vector = await generateVector(text);
    return pgvector.toSql(vector);
  } catch {
    throw new Error("Failed to generate embedding");
  }
};

export const isInappropriateCheck = async ({
  orgId,
  plainText,
  imageUrls,
}: {
  orgId: string;
  plainText: string;
  imageUrls?: string[];
}) => {
  try {
    const { activeSubscription } = await getSubscriptionQuery({ orgId });

    if (activeSubscription === "free") return false;

    const prompt = `
      You are a strict content moderator. Analyze the provided text and images (via URLs) for inappropriate content including spam, violence, sexual material, hate speech, harassment, illegal activities, or anything harmful/unsafe.

      Respond ONLY with a valid JSON object that follows this structure exactly:
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
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: [{ type: "text", text: `User Text: "${plainText}"` }],
      },
    ];

    imageUrls?.forEach((url) => {
      messages[1].content.push({
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

    const content = data?.choices?.[0]?.message?.content;

    if (!content) return true;

    const parsedContent = JSON.parse(content) as {
      isInappropriate: boolean;
      confidenceScore: number;
    };

    const { isInappropriate, confidenceScore } = parsedContent;

    if (isInappropriate && confidenceScore > 0.7) {
      return true;
    }

    return false;
  } catch (error) {
    throw error;
  }
};

export const getImageUrls = (htmlContent: string) => {
  const root = parse(htmlContent);

  const imageElements: HTMLElement[] = root.querySelectorAll("img");

  const imageUrls = imageElements
    .map((imgElement) => imgElement.getAttribute("src"))
    .filter((src): src is string => !!src);

  return imageUrls;
};

export const getPlainText = (htmlString: string) => {
  const plainText = convert(sanitizeHtml(htmlString), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      { selector: "table", format: "inline" },
    ],
  })
    .replace(/\s+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  return plainText;
};

export const clean = (htmlString: string) => {
  return sanitizeHtml(htmlString, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "a", "span"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      span: ["data-type", "data-id", "data-label"],
      img: ["src", "width", "height", "alt"],
    },
    allowedClasses: {
      span: ["mention"],
    },
  });
};
