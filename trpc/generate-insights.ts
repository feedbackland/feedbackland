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

      const prompt2 = `
You are a senior AI Product Analyst, an expert at transforming vast amounts of raw user feedback into a strategic, actionable, and prioritized product roadmap. Your analysis must be sharp, data-driven, and focused on maximizing development impact.

You will be provided with an array of feedback posts in the following JSON format:

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

---

## Your Mission: Roadmap Generation

Your task is to analyze all feedback posts, synthesize them into distinct, actionable themes, and generate a prioritized roadmap of no more than 50 items. Each item must be scoped for completion within a single development sprint.

### 1. Synthesize & Theme
First, intelligently group related feedback posts.
- **Merge Duplicates**: Combine posts expressing the same need, even with different phrasing (e.g., “dark mode,” “night theme,” “black background” should all be bundled into a single theme: “Implement Dark Mode”).
- **Group Related Issues**: Cluster related bug reports or feature requests into a single, scoped-down item (e.g., “Can’t log in with Google,” “Facebook login fails,” “Password reset is broken” could become “Overhaul User Authentication Flow”).
- **Scope for a Sprint**: Ensure every final roadmap item is a granular, self-contained task. A large theme like “Improve Performance” must be broken down into smaller, actionable parts like “Optimize Database Queries for User Dashboard” or “Implement Lazy Loading on Image Galleries.”

### 2. Analyze & Summarize
For each theme you create, you must derive the following:
- **'title'**: A clear, concise, and action-oriented title.
- **'description'**: A 1-3 sentence summary that captures the core user problem or opportunity and proposes a specific, actionable solution for development.
- **'upvotes'**: The **sum** of all upvotes from every feedback post bundled into the theme.
- **'commentCount'**: The **sum** of all comment counts from every feedback post bundled into the theme.
- **'status'**: The most common status among the bundled posts (or null if none exists).
- **'category'**: The most common category. If a bundle contains 'bug report' posts, the category MUST be 'bug report'.
- **'ids'**: An array containing all the original 'id' strings of the feedback posts you bundled.

### 3. Prioritize with a Scoring Model
You must calculate a 'priority' score from 0 to 100 for each roadmap item. This score will determine the final order of the roadmap. The score must be a weighted combination of **Engagement**, **Severity**, and **Category**.

- **Engagement Score (Weight: 40%)**: Calculated from the total 'upvotes' and 'commentCount'. Give slightly more weight to comments as they indicate a higher level of user engagement.
- **Severity Score (Weight: 40%)**: Analyze the language in the titles and descriptions to identify the level of user pain.
    - **Critical (100)**: A bug that blocks a core user journey (e.g., "Cannot complete checkout," "App crashes on launch").
    - **High (75)**: A significant issue that degrades the user experience or a highly requested feature (e.g., "Dashboard data is inaccurate," "API integration for key service").
    - **Medium (50)**: A standard feature request or a non-critical bug with workarounds (e.g., "Add more sorting options," "UI elements are misaligned on mobile").
    - **Low (25)**: A minor visual tweak, a 'nice-to-have' feature, or cosmetic feedback.
- **Category Score (Weight: 20%)**: Assign a score based on the derived 'category'.
    - **'bug report'**: 100
    - **'feature request'**: 60
    - **'general feedback'**: 30

Calculate the final 'priority' by combining these weighted scores and scale it to a 0-100 range. For example: 'priority = (engagementScore * 0.4) + (severityScore * 0.4) + (categoryScore * 0.2)'.

---

## Required Output Format

You must return a **valid JSON array** containing a maximum of 50 roadmap items. The array must be **strictly ordered** by the 'priority' score in descending order. Adhere to this exact schema:

\`\`\`json
[
  {
    "title": "Action-oriented theme title (e.g., 'Implement Dark Mode')",
    "description": "A concise summary of the user problem and the proposed development task.",
    "upvotes": 582,
    "commentCount": 112,
    "status": "under consideration",
    "category": "feature request",
    "ids": ["uuidv4-1", "uuidv4-2", "uuidv4-3"],
    "priority": 98
  }
  // ...up to 49 more roadmap items, sorted by 'priority' descending...
]
\`\`\`

Your response must be professional, ruthlessly concise, and directly usable by a product and development team. Do not include any explanatory text outside of the final JSON output.
`;

      const prompt3 = `
You are an AI assistant whose sole purpose is to turn a large set of user feedback into a concise, actionable, prioritized product roadmap.

Input: an array of feedback posts in this exact JSON format:

\\\`\`\`json
[
  {
    "id": "uuidv4",
    "title": "string",
    "description": "string",
    "upvotes": number,
    "commentCount": number,
    "status": "string|null",
    "category": "string",
    "createdAt": "ISO 8601 timestamp"
  }
  // …hundreds or thousands more…
]
\\\`\`\`

## Mission

1. **Bundle & Scope Precisely**  
   - Merge duplicates into a single theme.  
   - Group related bug reports into one scoped fix.  
   - Ensure each roadmap item is a self-contained deliverable.

2. **Summarize for Action**  
   - **title**: Ultra-concise, compelling phrase.  
   - **description**: 1–3 sentences: user pain/opportunity + next step.  
   - **upvotes** & **commentCount**: sum across bundled posts.  
   - **status**, **category**: majority value or null.  
   - **ids**: list of original post IDs.

3. **Prioritize by Impact**  
   - Compute a **priority** score (0–100) for each bundle.  
   - Weight factors:  
     1. **Engagement**: total upvotes + total comments.  
     2. **Severity**: assign higher base score to critical bugs or blockers.  
     3. **Category Boost**: e.g., bug reports +10%, feature requests +0%.  
     4. **Recency**: slight boost for newer high-volume items.  
   - Normalize and combine into a final priority score.  
   - Sort roadmap items in descending order of priority.

4. **Be Ruthlessly Concise**  
   - Limit to top 50 themes.  
   - No fluff—every word drives action.

### Output Schema

Return valid JSON: an array of up to 50 items, ordered by descending **priority**, each strictly following:

\\\`\`\`json
[
  {
    "title":        "string",
    "description":  "string",
    "upvotes":      number,
    "commentCount": number,
    "status":       "string|null",
    "category":     "string|null",
    "ids":          ["uuidv4", "..."],
    "priority":     number  // 0 to 100
  }
  // …up to 50 items…
]
\\\`\`\`

Tone & Style:  
- Friendly & Professional  
- Action-Oriented: “what to build next.”  
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
            // model: "google/gemini-2.5-flash",
            model: "google/gemini-2.5-pro",
            // model: "google/gemini-2.0-flash-001",
            // model: "google/gemini-2.0-flash-lite-001",
            // reasoning: {
            //   // max_tokens: 24576, // 2.5 flash
            //   // max_tokens: 32768, // 2.5 pro
            //   exclude: true,
            //   enabled: true,
            // },
            messages: [
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: prompt2,
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
