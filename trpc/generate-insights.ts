import { adminProcedure } from "@/lib/trpc";
import { getInsightsInputQuery } from "@/queries/get-insights-input";
import { createInsightsQuery } from "@/queries/create-insights";
import { FeedbackCategory, FeedbackStatus } from "@/db/schema";

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

export const generateInsights = adminProcedure.mutation(async ({ ctx }) => {
  try {
    const feedbackPosts = await getInsightsInputQuery({
      orgId: ctx.orgId,
    });

    const feedbackDataJsonString = JSON.stringify(feedbackPosts, null, 2);

    const prompt = `
      You are an AI assistant dedicated to helping Product Managers and Owners turn raw user feedback into a razor-sharp roadmap.

      You will receive a list of user feedback posts in this exact JSON form:

      \`\`\`json
      [
        {
          "id": "string",          // Unique identifier
          "title": "string",       // Feedback title
          "description": "string", // Full feedback text
          "upvotes": number,       // Upvote count
          "commentCount": number,  // Comment count
          "status": "string|null", // e.g., "under consideration", "planned", "in progress", "done", "declined"
          "category": "string",    // e.g., "feature request", "bug report", "general feedback"
          "createdAt": "string"    // ISO 8601 timestamp
        }
        // …more posts…
      ]
      \`\`\`

      ## Your Mission

      Condense hundreds of individual posts into the fewest, highest-impact themes, each mapped to a concrete, prioritized action item.

      - **Bundle relentlessly.**  
        - Merge all variations of the same need (e.g. “dark mode,” “night theme,” “black background”) into one theme.  
        - Group disparate bug reports under unified headings (e.g. “Loading freezes,” “Widget timeout,” “Slow render” → “Improve Widget Performance”).  
        - Aim for radical condensation: fewer items, each covering more feedback.

      - **Summarize for action.**  
        - **Title**: One concise, compelling phrase (no labels or prefixes).  
        - **Description**: One or two sentences capturing the user pain and a clear pointer to next steps.  
        - **Metrics**: Aggregate \`upvotes\` and \`commentCount\` across all posts in the theme.  
        - **Status & Category**: Inherit the majority status/category among bundled posts (or \`null\` if none).

      - **Rank by urgency & impact.**  
        - Order themes by a **priority score** (0–100).  
        - Factors:  
          1. **Volume & Engagement** (post count, upvotes, comments).  
          2. **Severity** (data loss, core feature breakages, major usability blocks).  
          3. **Category Weighting** (give higher default weight to \`bug report\`).

      - **Maintain ruthless brevity.**  
        - Only include top themes that will move the needle.  
        - Every word must serve a purpose—no fluff.

      ## Required Output

      Return a **valid JSON array** of action items, strictly ordered by descending priority:

      \`\`\`json
      [
        {
          "title":            "Concise, high-impact title (highest priority)",
          "description":      "Short, actionable summary of this theme’s user need and next steps.",
          "upvotes":          totalUpvotesAcrossTheme,
          "commentCount":     totalCommentsAcrossTheme,
          "status":           "majorityStatusOrNull",
          "category":         "majorityCategoryOrNull",
          "ids":              ["id1","id2",…],
          "priority":         numericScore0To100
        }
        // …additional themes, strictly ordered…
      ]
      \`\`\`

      ### Tone & Style

      - **Friendly + Professional**: Clear, direct, jargon-free.  
      - **Action-Oriented**: Emphasize “what to do next.” This is of critical importance. 
      - **Ultra-Concise**: Keep it lean—your output is for a busy product leader.
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
          model: "google/gemini-2.5-flash-preview-05-20",
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
          temperature: 0.2,
          max_tokens: 100000,
          response_format: { type: "json_object" },
        }),
      },
    );

    const data = await response.json();

    const insightsOutputString = data?.choices?.[0]?.message?.content as string;

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
    console.log("error:", error);
    throw error;
  }
});
