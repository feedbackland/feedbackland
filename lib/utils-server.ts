import pgvector from "pgvector/pg";
import { parse, HTMLElement } from "node-html-parser";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";

export const LLM_MODEL = "google/gemini-3.6-flash";

/**
 * How hard the model should think, chosen per call site.
 *
 * Gemini 3 models always think, and how much they think by default is a
 * property of the model rather than of the request — Flash Lite defaulted to
 * the least, Flash deliberates. Leaving it unset means the next model swap
 * silently changes the latency and the bill on every one of these calls, so
 * each one states what it needs.
 *
 * There is no "off": OpenRouter rejects `effort: "none"`, `enabled: false` and
 * `max_tokens: 0` for this model with `400 Reasoning is mandatory for this
 * endpoint and cannot be disabled`. "minimal" is the floor.
 *
 * The levels below are measured, not guessed. On the real prompts in this repo,
 * "minimal" moderates and titles identically to the default while spending no
 * reasoning tokens, but it miscounts a corpus — which is why reading the board
 * asks for one level up.
 */
export const REASONING = {
  /** Classify, label, or rewrite one piece of text. Nothing to weigh up. */
  mechanical: { effort: "minimal" },
  /** Read the whole board to answer a question. "minimal" counts wrong. */
  analytical: { effort: "low" },
  /** Group and score hundreds of posts against each other. */
  deliberative: { effort: "medium" },
} as const satisfies Record<string, { effort: string }>;

type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const generateVector = async (text: string, taskType: EmbeddingTaskType) => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: text,
        encoding_format: "float",
        task_type: taskType,
      }),
    });

    const data = await response.json();

    return data?.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
};

export const generateQueryVector = async (text: string) => {
  return generateVector(text, "RETRIEVAL_QUERY");
};

export const generateSQLEmbedding = async (text: string) => {
  try {
    const vector = await generateVector(text, "RETRIEVAL_DOCUMENT");

    if (vector) {
      return pgvector.toSql(vector);
    }

    return null;
  } catch {
    return null;
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
    const prompt = `
      You are a strict content moderator. Analyze the provided text and images (via URLs) for inappropriate content including spam, nonsensical rambling, violence, sexual material, hate speech, harassment, illegal activities, or anything harmful/unsafe.

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
          model: LLM_MODEL,
          messages,
          // Runs on the path of every post and comment, before the author is
          // told whether theirs was accepted, so it takes the cheapest level
          // that still agrees with the deliberated verdict.
          reasoning: REASONING.mechanical,
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
