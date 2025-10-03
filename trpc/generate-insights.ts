import { adminProcedure } from "@/lib/trpc";
import { getInsightsInputQuery } from "@/queries/get-insights-input";
import { createInsightsQuery } from "@/queries/create-insights";
import { z } from "zod/v4";

const insightsOutputSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string(),
    upvotes: z.number(),
    commentCount: z.number(),
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
    ids: z.array(z.string()),
    priority: z.number(),
  }),
);

export const generateInsights = adminProcedure.mutation(async (opts) => {
  let retries = 3;

  try {
    while (retries > 0) {
      const { ctx } = opts;

      const feedbackPosts = await getInsightsInputQuery({
        orgId: ctx.orgId,
      });

      const systemPrompt = `
        You are an AI assistant whose sole purpose is to turn a vast array of user feedback into a condensed, actionable, prioritized product roadmap.

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
          // ...potentially hundreds or thousands more posts...
        ]
        \`\`\`

        ## Your Mission
        Transform hundreds or thousands of posts into 1-50 well-scoped roadmap items, each small enough to ship in a sprint and ordered by impact:

        1. Bundle & Scope Precisely
          - Merge duplicate needs into one theme (e.g. “dark mode,” “night theme,” “black background” → “Dark Mode”).
          - Group related bug reports into a single, scoping-limited fix (e.g. “loading freeze,” “timeout,” “slow render” → “Optimize Widget Load Performance”).
          - Ensure each roadmap item maps to a single, deliverable feature.

        2. Summarize for Action
          - title: Ultra-concise, compelling phrase.
          - description: 1-3 sentences: user pain/opportunity + specific next step.
          - upvotes & commentCount: summed across bundled posts.
          - status & category: majority value (or null if none).

        3. Prioritize by Impact
          - Assign a priority (0-100) and sort descending.
          - Weight by:
            1. Engagement (volume, upvotes, comments)
            2. Severity (critical bugs, usability blocks)
            3. Category Boost (higher weight to 'bug report')

        4. Be Ruthlessly Concise
          - Only top themes that will move the needle.
          - No fluff. Every word must drive action.

        ## Required Output Format

        You must return a single, valid JSON array containing a maximum of 50 roadmap items. The array must be strictly ordered by the 'priority' field in descending order. Adhere precisely to the provided JSON schema. No additional text, explanations, or markdown are permitted outside of the JSON array. Any deviation from the schema will result in a processing failure.

        ### Output JSON Schema:
        \`\`\`json
        {
          "type": "array",
          "maxItems": 50,
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string",
                "description": "Ultra-concise, compelling phrase."
              },
              "description": {
                "type": "string",
                "description": "1-3 sentences: user pain/opportunity + specific next step."
              },
              "upvotes": {
                "type": "number",
                "description": "Summed upvotes across all bundled posts."
              },
              "commentCount": {
                "type": "number",
                "description": "Summed comment count across all bundled posts."
              },
              "status": {
                "type": ["string", "null"],
                "enum": ["under consideration", "planned", "in progress", "done", "declined", null]
              },
              "category": {
                "type": ["string", "null"],
                "enum": ["feature request", "bug report", "general feedback", null]
              },
              "ids": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Array of original feedback post IDs bundled into this item."
              },
              "priority": {
                "type": "number",
                "minimum": 0,
                "maximum": 100,
                "description": "Calculated priority score (0-100)."
              }
            },
            "required": [
              "title",
              "description",
              "upvotes",
              "commentCount",
              "status",
              "category",
              "ids",
              "priority"
            ]
          }
        }
        \`\`\`

        ### Output JSON Example:
        \`\`\`json
        [
          {
            "title": "Fix Critical Login Failures",
            "description": "Multiple users are reporting being unable to log in, blocking all application access. This requires an immediate investigation into the authentication service.",
            "upvotes": 88,
            "commentCount": 112,
            "status": "under consideration",
            "category": "bug report",
            "ids": ["d4a1b3f2-1c8e-4a9f-8b2c-3e5f7a1d9c0b", "e5b2c4g3-2d9f-5b0g-9c3d-4f6g8b2e0d1c"],
            "priority": 98
          },
          {
            "title": "Implement Dark Mode",
            "description": "Users consistently request a dark mode to reduce eye strain in low-light environments. Implement a switch in the UI to enable a dark theme.",
            "upvotes": 254,
            "commentCount": 97,
            "status": "under consideration",
            "category": "feature request",
            "ids": ["35ee85f0-3f37-4c06-b5fe-1a2a4dc983a3", "2c174bb9-1771-4bce-b7e9-ddad35525fbd", "f8d9e0a1-4b1a-5c3e-ad5b-6g9h1i2j3k4l"],
            "priority": 95
          }
        ]
        \`\`\`

        Remember: Your final output must be **only** the JSON array, correctly formatted and sorted.
      `;

      const systemPrompt2 = `
        You are a senior product analyst AI. Your mission is to meticulously analyze raw user feedback and transform it into a strategic, prioritized product roadmap. You are an expert at identifying underlying themes, quantifying user needs, and translating them into actionable development items.

        You will be provided with an array of user feedback posts in the following JSON format:

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
          // ...potentially hundreds or thousands more posts...
        ]
        \`\`\`

        ## Your Core Directives

        Your task is to synthesize this raw feedback into 1-50 high-impact roadmap items, each scoped for a single development sprint and ordered by strategic priority.

        ### 1. Thematic Bundling & Precise Scoping
        - **Synthesize Themes:** Aggressively merge feedback posts that describe the same underlying need into a single, coherent theme. For example, user requests for “dark mode,” “night theme,” and “a black background” should be consolidated into a single theme: “Implement Dark Mode.”
        - **Group Related Issues:** Combine related bug reports into a single, well-defined fix. For instance, reports of “application freezes on load,” “data fetch timeouts,” and “slow component rendering” should be grouped into an actionable item like “Optimize Widget Loading Performance.”
        - **Ensure Actionability:** Every roadmap item must represent a single, deliverable feature or fix. Avoid overly broad or ambiguous items.

        ### 2. Action-Oriented Summarization
        For each bundled roadmap item, you will generate the following:
        - **title:** A concise, compelling, and action-oriented title.
        - **description:** A 1-3 sentence summary that clearly articulates the user pain point or opportunity and proposes a specific, actionable solution.
        - **upvotes & commentCount:** The sum of 'upvotes' and 'commentCount' from all bundled feedback posts.
        - **status & category:** The most common value for 'status' and 'category' among the bundled posts. If no clear majority exists, default to 'null'.
        - **ids:** An array of the original 'id' strings from all included feedback posts.

        ### 3. Impact-Based Prioritization
        - **Assign Priority Score:** Calculate a priority score from 0 to 100 for each roadmap item and sort the final output in descending order of this score.
        - **Prioritization Formula:** Your prioritization should be heavily weighted by the following factors, in order:
          1.  **Severity & Urgency:** Critical bug reports and usability blockers that prevent users from completing core tasks must be given the highest weight.
          2.  **User Engagement:** Quantify impact using the volume of posts, total upvotes, and total comments for a theme. Higher engagement signifies a more widespread need.
          3.  **Category Boost:** Apply a significant boost to items categorized as 'bug report' over 'feature request' or 'general feedback'.

        ### 4. Ruthless Conciseness
        - **Focus on Impact:** Your output should only include the most critical themes that will meaningfully improve the product.
        - **Eliminate Fluff:** Every word must serve the purpose of driving action. Be direct and to the point.

        ## Required Output Format

        You must return a single, valid JSON array containing a maximum of 50 roadmap items. The array must be strictly ordered by the 'priority' field in descending order. Adhere precisely to the provided JSON schema. No additional text, explanations, or markdown are permitted outside of the JSON array. Any deviation from the schema will result in a processing failure.

        ### Output JSON Schema:
        \`\`\`json
        {
          "type": "array",
          "maxItems": 50,
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string",
                "description": "Ultra-concise, compelling phrase."
              },
              "description": {
                "type": "string",
                "description": "1-3 sentences: user pain/opportunity + specific next step."
              },
              "upvotes": {
                "type": "number",
                "description": "Summed upvotes across all bundled posts."
              },
              "commentCount": {
                "type": "number",
                "description": "Summed comment count across all bundled posts."
              },
              "status": {
                "type": ["string", "null"],
                "enum": ["under consideration", "planned", "in progress", "done", "declined", null]
              },
              "category": {
                "type": ["string", "null"],
                "enum": ["feature request", "bug report", "general feedback", null]
              },
              "ids": {
                "type": "array",
                "items": {
                  "type": "string"
                },
                "description": "Array of original feedback post IDs bundled into this item."
              },
              "priority": {
                "type": "number",
                "minimum": 0,
                "maximum": 100,
                "description": "Calculated priority score (0-100)."
              }
            },
            "required": [
              "title",
              "description",
              "upvotes",
              "commentCount",
              "status",
              "category",
              "ids",
              "priority"
            ]
          }
        }
        \`\`\`

        ### Output JSON Example:
        \`\`\`json
        [
          {
            "title": "Fix Critical Login Failures",
            "description": "Multiple users are reporting being unable to log in, blocking all application access. This requires an immediate investigation into the authentication service.",
            "upvotes": 88,
            "commentCount": 112,
            "status": "under consideration",
            "category": "bug report",
            "ids": ["d4a1b3f2-1c8e-4a9f-8b2c-3e5f7a1d9c0b", "e5b2c4g3-2d9f-5b0g-9c3d-4f6g8b2e0d1c"],
            "priority": 98
          },
          {
            "title": "Implement Dark Mode",
            "description": "Users consistently request a dark mode to reduce eye strain in low-light environments. We should add a UI toggle to enable a dark theme.",
            "upvotes": 254,
            "commentCount": 97,
            "status": "under consideration",
            "category": "feature request",
            "ids": ["35ee85f0-3f37-4c06-b5fe-1a2a4dc983a3", "2c174bb9-1771-4bce-b7e9-ddad35525fbd", "f8d9e0a1-4b1a-5c3e-ad5b-6g9h1i2j3k4l"],
            "priority": 95
          }
        ]
        \`\`\`

        Remember: Your final output must be **only** the JSON array, correctly formatted and sorted, and containing a maximum of 50 items.
      `;

      const feedbackDataJsonString = JSON.stringify(feedbackPosts, null, 2);

      const userPrompt = `
        Here is the JSON array of feedback posts you need to analyze and create a condensed, prioritized roadmap for:

        ${feedbackDataJsonString}

        Remember: Your final output must be **only** the JSON array, correctly formatted and sorted, and containing a maximum of 50 items.
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
            model: "google/gemini-2.5-flash-lite-preview-09-2025",
            reasoning: {
              exclude: true,
              enabled: true,
            },
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: systemPrompt2,
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
          }),
        },
      );

      const data = await response.json();

      const responseText = data?.choices?.[0]?.message?.content;

      if (!responseText || responseText.length === 0) {
        throw new Error("Invalid or empty response from the LLM");
      }

      const parsedResult = insightsOutputSchema.safeParse(
        JSON.parse(responseText),
      );

      if (!parsedResult.success) {
        throw new Error("insightsOutputSchema validation failed.");
      }

      const insightsOutput = parsedResult.data;

      if (!Array.isArray(insightsOutput) || insightsOutput.length === 0) {
        throw new Error("insightsOutput is not a valid non-empty array");
      }

      const result = await createInsightsQuery(
        insightsOutput.map((item) => ({
          orgId: ctx.orgId,
          title: item.title,
          description: item.description,
          upvotes: Number(item?.upvotes || 0),
          commentCount: Number(item?.commentCount || 0),
          status: item.status,
          category: item.category,
          ids: item.ids,
          priority: Number(item?.priority || 0),
        })),
      );

      return result;
    }
  } catch (error) {
    console.log(error);

    retries--;

    if (retries === 0) {
      throw error;
    }
  }
});
