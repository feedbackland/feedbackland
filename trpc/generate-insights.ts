import { adminProcedure } from "@/lib/trpc";
import { getInsightsInputQuery } from "@/queries/get-insights-input";
import { createInsightsQuery } from "@/queries/create-insights";
import { getRoadmapLimit } from "./get-roadmap-limit";
import { z } from "zod";

const insightsOutputSchema = z
  .array(
    z.object({
      title: z.string().min(1, "Title is required").max(200, "Title too long"),
      description: z
        .string()
        .min(1, "Description is required")
        .max(1000, "Description too long"),
      upvotes: z.number().min(0, "Upvotes must be non-negative"),
      commentCount: z.number().min(0, "Comment count must be non-negative"),
      status: z
        .enum([
          "under consideration",
          "planned",
          "in progress",
          "done",
          "declined",
        ])
        .nullable(),
      category: z
        .enum(["feature request", "bug report", "general feedback"])
        .nullable(),
      ids: z
        .array(z.string().uuid("Invalid UUID format"))
        .min(1, "At least one ID required"),
      priority: z
        .number()
        .min(0, "Priority must be non-negative")
        .max(100, "Priority must be <= 100"),
    }),
  )
  .min(1, "At least one insight required")
  .max(50, "Maximum 50 insights allowed");

// Validation helper function
function validateAndSanitizeInsights(rawInsights: any[]): any[] {
  return rawInsights
    .map((insight, index) => {
      try {
        return {
          title: String(insight.title || `Insight ${index + 1}`)
            .trim()
            .slice(0, 200),
          description: String(insight.description || "No description provided")
            .trim()
            .slice(0, 1000),
          upvotes: Math.max(0, Number(insight.upvotes) || 0),
          commentCount: Math.max(0, Number(insight.commentCount) || 0),
          status: insight.status || null,
          category: insight.category || null,
          ids: Array.isArray(insight.ids)
            ? insight.ids.filter(
                (id: any) => typeof id === "string" && id.length > 0,
              )
            : [],
          priority: Math.min(100, Math.max(0, Number(insight.priority) || 0)),
        };
      } catch (error) {
        console.warn(`Failed to sanitize insight at index ${index}:`, error);
        return null;
      }
    })
    .filter(Boolean);
}

export const generateInsights = adminProcedure.mutation(async (opts) => {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { limitReached } = await getRoadmapLimit(opts as any);

      if (limitReached) throw new Error("Roadmap limit reached");

      const { ctx } = opts;

      const feedbackPosts = await getInsightsInputQuery({
        orgId: ctx.orgId,
      });

      if (!feedbackPosts || feedbackPosts.length === 0) {
        throw new Error("No feedback posts found");
      }

      const systemPrompt = `
You are an AI assistant whose sole purpose is to turn a vast array of user feedback into a condensed, actionable, prioritized product roadmap.

CRITICAL: You MUST use the insights_formatter function to structure your response. Do NOT return raw JSON or any other format.

You will receive an array of feedback posts in this exact JSON format:

\`\`\`json
[
  {
    "id": "uuidv4",         // Unique identifier for the feedback post
    "title": "string",      // Feedback title
    "description": "string",// Full feedback text
    "upvotes": number,      // Number of upvotes
    "commentCount": number, // Number of comments
    "status": "string|null",// "under consideration", "planned", "in progress", "done", "declined"
    "category": "string",   // "feature request", "bug report", "general feedback"
    "createdAt": "string"   // ISO 8601 timestamp of creation
  }
]
\`\`\`

## Your Mission
Transform feedback into 1-50 well-scoped roadmap items, each small enough to ship in a sprint and ordered by impact:

1. Bundle & Scope Precisely  
  - Merge duplicate needs into one theme (e.g. "dark mode," "night theme," "black background" → "Dark Mode").  
  - Group related bug reports into a single, scoping-limited fix.  
  - Ensure each roadmap item maps to a single, deliverable feature.

2. Summarize for Action  
  - title: Ultra-concise, compelling phrase (max 200 chars).  
  - description: 1-3 sentences: user pain/opportunity + specific next step (max 1000 chars).  
  - upvotes & commentCount: summed across bundled posts.  
  - status & category: majority value (or null if none).

3. Prioritize by Impact  
  - Assign a priority (0-100) and sort descending.  
  - Weight by:  
    1. Engagement (volume, upvotes, comments)  
    2. Severity (critical bugs, usability blocks)  
    3. Category Boost (higher weight to 'bug report')

4. VALIDATION REQUIREMENTS:
  - Each insight MUST have at least one valid UUID in the ids array
  - Title and description MUST be non-empty strings
  - Numbers MUST be valid integers >= 0
  - Priority MUST be between 0-100
  - Status MUST be one of: "under consideration", "planned", "in progress", "done", "declined", or null
  - Category MUST be one of: "feature request", "bug report", "general feedback", or null

You MUST call the insights_formatter function with your analysis. Do not return raw JSON.
`;

      const feedbackDataJsonString = JSON.stringify(feedbackPosts, null, 2);

      const userPrompt = `
Here is the array of feedback posts you need to analyze and create a condensed, prioritized roadmap for:

\`\`\`json
${feedbackDataJsonString}
\`\`\`

Remember: You MUST use the insights_formatter function to structure your response. Validate all data types and ensure all required fields are present.
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
            tools: [
              {
                type: "function",
                function: {
                  name: "insights_formatter",
                  description:
                    "REQUIRED: Formats the user feedback into a structured JSON object, representing a prioritized roadmap. This function MUST be called - do not return raw JSON.",
                  parameters: {
                    type: "object",
                    properties: {
                      insights: {
                        type: "array",
                        minItems: 1,
                        maxItems: 50,
                        items: {
                          type: "object",
                          properties: {
                            title: {
                              type: "string",
                              minLength: 1,
                              maxLength: 200,
                              description:
                                "Ultra-concise, compelling theme title.",
                            },
                            description: {
                              type: "string",
                              minLength: 1,
                              maxLength: 1000,
                              description:
                                "1-3 sentences of user pain + specific next step.",
                            },
                            upvotes: {
                              type: "integer",
                              minimum: 0,
                              description:
                                "Number of total upvotes for this theme.",
                            },
                            commentCount: {
                              type: "integer",
                              minimum: 0,
                              description:
                                "Number of total comments for this theme.",
                            },
                            status: {
                              type: ["string", "null"],
                              enum: [
                                "under consideration",
                                "planned",
                                "in progress",
                                "done",
                                "declined",
                                null,
                              ],
                              description: "Majority status or null.",
                            },
                            category: {
                              type: ["string", "null"],
                              enum: [
                                "feature request",
                                "bug report",
                                "general feedback",
                                null,
                              ],
                              description: "Majority category or null.",
                            },
                            ids: {
                              type: "array",
                              minItems: 1,
                              items: {
                                type: "string",
                                pattern:
                                  "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                                description: "Valid UUID v4 format",
                              },
                              description:
                                "Original feedback post ids (UUIDs).",
                            },
                            priority: {
                              type: "integer",
                              minimum: 0,
                              maximum: 100,
                              description: "Priority score 0-100.",
                            },
                          },
                          required: [
                            "title",
                            "description",
                            "upvotes",
                            "commentCount",
                            "status",
                            "category",
                            "ids",
                            "priority",
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["insights"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: {
                name: "insights_formatter",
              },
            },
            messages: [
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: systemPrompt,
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: userPrompt,
                  },
                ],
              },
            ],
            temperature: 0.1,
            // max_tokens: 4000, // Ensure enough tokens for complete response
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Enhanced error checking
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No choices in API response");
      }

      const choice = data.choices[0];
      if (!choice.message) {
        throw new Error("No message in API response");
      }

      // Check for finish_reason that might indicate incomplete response
      if (choice.finish_reason === "length") {
        console.warn("Response may be truncated due to length limit");
      }

      const toolCall = choice.message.tool_calls?.[0];

      if (
        !toolCall ||
        toolCall.type !== "function" ||
        toolCall.function.name !== "insights_formatter"
      ) {
        console.log(
          "Invalid tool call:",
          JSON.stringify(choice.message, null, 2),
        );
        throw new Error("Invalid or missing tool call in response");
      }

      const insightsOutputString = toolCall.function.arguments;

      if (!insightsOutputString || insightsOutputString.length === 0) {
        throw new Error("Empty function arguments");
      }

      let parsedOutput;
      try {
        parsedOutput = JSON.parse(insightsOutputString);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Raw arguments:", insightsOutputString);
        throw new Error("Failed to parse function arguments as JSON");
      }

      if (!parsedOutput.insights || !Array.isArray(parsedOutput.insights)) {
        throw new Error("Invalid insights structure in response");
      }

      // Sanitize and validate the insights
      const sanitizedInsights = validateAndSanitizeInsights(
        parsedOutput.insights,
      );

      if (sanitizedInsights.length === 0) {
        throw new Error("No valid insights after sanitization");
      }

      // Final schema validation
      const insightsOutput = insightsOutputSchema.parse(sanitizedInsights);

      const result = await createInsightsQuery(
        insightsOutput.map((item) => ({
          orgId: ctx.orgId,
          title: item.title,
          description: item.description,
          upvotes: Number(item.upvotes || 0),
          commentCount: Number(item.commentCount || 0),
          status: item.status,
          category: item.category,
          ids: item.ids,
          priority: Number(item.priority || 0),
        })),
      );

      return result;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error as Error;

      if (attempt === maxRetries) {
        // Log final attempt details for debugging
        console.error("All retry attempts failed. Final error:", lastError);
      } else {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error("Unknown error after all retries");
});
