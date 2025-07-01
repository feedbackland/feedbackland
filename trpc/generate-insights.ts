import { adminProcedure } from "@/lib/trpc";
import { getInsightsInputQuery } from "@/queries/get-insights-input";
import { createInsightsQuery } from "@/queries/create-insights";
import { FeedbackCategory, FeedbackStatus } from "@/db/schema";
import { getRoadmapLimit } from "./get-roadmap-limit";

interface InsightsOutputItem {
  title: string;
  description: string;
  upvotes: number | string;
  commentCount: number | string;
  status: FeedbackStatus | null;
  category: FeedbackCategory | null;
  ids: string[];
  priority: number | string;
}

export const generateInsights = adminProcedure.mutation(async (opts) => {
  const { limitReached } = await getRoadmapLimit(opts as any);

  if (!limitReached) {
    try {
      const { ctx } = opts;

      const feedbackPosts = await getInsightsInputQuery({
        orgId: ctx.orgId,
      });

      const feedbackDataJsonString = JSON.stringify(feedbackPosts, null, 2);

      const prompt = `
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

        Required Output:
        Return valid JSON: an array consisting of maximum 50 roadmap items, strictly ordered by descending 'priority', strictly following this schema:

        \`\`\`json
        [
          {
            "title":        "Ultra-concise, compelling theme title",
            "description":  "1-3 sentences of user pain + specific next step",
            "upvotes":      123,                      // total upvotes for this theme
            "commentCount": 45,                       // total comments for this theme
            "status":       "majorityStatusOrNull",   // or null
            "category":     "majorityCategoryOrNull", // or null
            "ids":          ["feedbackPostId1","feedbackPostId2","feedbackPostId3"], // original feedback post ids (of type uuidv4), directly linked to ids from the input array
            "priority":     95                        // 0-100 score
          }
          // …1-50 more roadmap items, sorted by priority…
        ]
        \`\`\`

        Tone & Style:
        - Friendly & Professional  
        - Action-Oriented: Focus on “what to build next.”  
        - Ultra-Concise: Designed for a busy product owner.
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
            // model: "google/gemini-2.5-flash-lite-preview-06-17",
            model: "google/gemini-2.5-flash",
            // model: "google/gemini-2.5-pro",
            // model: "google/gemini-2.0-flash-001",
            // model: "google/gemini-2.0-flash-lite-001",
            reasoning: {
              // max_tokens: 24576, // 2.5 flash
              // max_tokens: 32768, // 2.5 pro
              exclude: true,
              enabled: true,
            },
            messages: [
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: prompt,
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: feedbackDataJsonString,
                  },
                ],
              },
            ],
            // temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        },
      );

      const data = await response.json();

      const insightsOutputString = data?.choices?.[0]?.message
        ?.content as string;

      if (!insightsOutputString || insightsOutputString.length === 0) {
        throw new Error("insightsOutputString is empty");
      }

      const insightsOutput: InsightsOutputItem[] =
        JSON.parse(insightsOutputString);

      if (!Array.isArray(insightsOutput) || insightsOutput.length === 0) {
        throw new Error("insightsOutput is not a valid JSON array");
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
    } catch (error) {
      throw error;
    }
  }
});
