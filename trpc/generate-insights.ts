import { adminProcedure } from "@/lib/trpc";
import { getFeedbackPostsForInsightsQuery } from "@/queries/get-feedback-posts-for-insights";
import { createInsightsQuery } from "@/queries/create-insight";
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
    const feedbackPosts = await getFeedbackPostsForInsightsQuery({
      orgId: ctx.orgId,
    });

    const feedbackDataJsonString = JSON.stringify(feedbackPosts, null, 2);

    const prompt = `
        You are an AI assistant specifically programmed to help product managers and product owners to analyze and act on user feedback.

        You will be provided with a list of user feedback posts. Each post follows this JSON structure:
        \`\`\`json
        {
          "id": "string",          // Unique identifier
          "title": "string",         // Feedback title
          "description": "string",   // Detailed feedback
          "upvotes": "number",       // Number of upvotes
          "commentCount": "number",  // Number of comments
          "status": "string | null", // e.g., 'under consideration', 'planned', 'in progress', 'done', 'declined'
          "category": "string",      // e.g., 'feature request', 'bug report', 'general feedback'
          "createdAt": "string"      // ISO 8601 timestamp
        }
        \`\`\`

        **Your Primary Objective:**
        Transform the raw feedback list into a **highly concise, prioritized list of actionable items, where each item represents a distinct, bundled overarching theme.** This list must be extremely relevant, useful and condensed for the team to guide product development and bug-fixing efforts. The absolute priority is to keep this list as short as possible by maximizing the bundling of similar feedback. Use a friendly but professional tone, avoid jargon and keep everything simple and easy to read an digest.

        **Critical Instructions:**

        1.  **Maximum Bundling & Thematic Clustering (Utmost Importance):**
            * Scrutinize all feedback posts to identify and **aggressively cluster** similar requests, related bug reports, and overlapping suggestions into broad, overarching themes.
            * Do not create separate items for slight variations of the same underlying issue or feature request. For instance, feedback like "need dark mode," "please add night theme," and "black background option" must all be bundled into a single theme like "Implement Dark Mode/Theme." Similarly, various complaints about slowness in different parts of the widget should be consolidated into one "Improve Widget Performance" theme.
            * The goal is to **radically condense** the feedback into the fewest possible, yet most comprehensive, thematic items.

        2.  **Summarization for Actionability:**
            * For each identified overarching theme/bundle, create a **very short, impactful title**. (e.g., "Address widespread widget loading failures", "Introduce advanced feedback filtering options", "Enhance AI summary accuracy"). Do not include any labels (e.g. "Bundle: ...") but just the title.
            * Provide a **concise description** (1-2 sentences maximum) that summarizes the core user need or problem within that theme and clearly points towards a potential area of investigation or action for the product.
            * Provide a priority score to indicate the importance, impact and urgency of this theme.

        3.  **Strict Prioritization:**
            * The final list of themed items **must be strictly ordered by priority**, from the most critical/impactful to the least.
            * Base prioritization on:
                * **Collective Impact:** Consider the total number of original posts, cumulative upvotes, and comment counts associated with each theme.
                * **Severity/Urgency:** Critical bug reports (e.g., data integrity issues, core feature malfunction) and frequently reported usability blockers take precedence.
                * **Strategic Value for the product:** Align with the product's focus on simplicity, ease of use, embeddability, and unique AI features.
                * **Category Signals:** Treat 'bug report' themes as generally higher urgency.

        4.  **Relevance & Conciseness of Final Output:**
            * The output list of themes must be **extremely short**. Focus only on the themes that represent the most significant pain points or most valuable opportunities.
            * Every word counts. Be direct and avoid fluff. The list must be immediately useful to a busy product manager or developer.

        **Required Output Format:**
        Return a JSON array of objects. Each object represents one prioritized, bundled theme:
        \`\`\`json
        [
          {
            "title": "Concise and Impactful Title 1 (Highest Priority)",
            "description": "Short, actionable description for item 1, summarizing the bundled feedback and its importance.",
            "upvotes": "sum of all upvotes in the theme",
            "commentCount": "sum of all comments in the theme",
            "status": "if any posts have a status reflect that; otherwise leave null",
            "category": "the category of the majority of posts in the theme",
            "ids": "the ids of the linked feedback posts",
            "priority": "the priority score of the theme ranging from 0 to 100, the higher the more important"
          },
          // ... more themes, strictly prioritized, list kept as short as possible.
        ]
        \`\`\`

        Now, process the following user feedback posts and generate this specific output:

        ${feedbackDataJsonString}
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
          model: "google/gemini-2.5-flash-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          // max_tokens: 150,
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
        feedback_post_ids: item.ids,
        priority: Number(item?.priority || 0),
      })),
    );

    return result;
  } catch (error) {
    throw error;
  }
});
