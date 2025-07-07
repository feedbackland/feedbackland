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

      const prompt4 = `You are an expert Senior Product Manager with a decade of experience in synthesizing user feedback and building actionable, prioritized product roadmaps for agile development teams. Your goal is to transform a raw list of user feedback posts into a strategic, sprint-sized roadmap that balances user demand, business impact, and development effort.

**TASK:**

Analyze the provided JSON array of user feedback posts. Your task is to group, prioritize, and redefine this feedback into a structured JSON product roadmap. The roadmap items you create should represent concrete features or bug fixes that can realistically be tackled by a development team in a typical sprint.

**INPUT FORMAT:**

You will receive a JSON array of feedback objects. Each object will have the following structure:

\`\`\`json
{
  "id": "uuidv4",
  "title": "string",
  "description": "string",
  "upvotes": "number",
  "commentCount": "number",
  "status": "string|null",
  "category": "string", // "feature request", "bug report", "general feedback"
  "createdAt": "string"
}
\`\`\`

**ANALYSIS & PRIORITIZATION LOGIC:**

1.  **Synthesize & Group:** Do not perform a 1:1 conversion. Analyze the titles and descriptions to identify underlying themes and group similar feedback posts together. For example, posts titled "Need a dark theme" and "Please add a night mode" should be grouped into a single roadmap item.
2.  **Prioritize Strategically:** Evaluate and score each synthesized roadmap item based on the following weighted factors to create a \`priorityScore\` (from 1 to 100, where 100 is highest priority):
    * **User Demand (50% weight):** Primarily driven by \`upvotes\`. Sum the upvotes of all related feedback posts. High comment counts (\`commentCount\`) should also positively influence this, as they indicate strong user engagement.
    * **Urgency & Impact (40% weight):**
        * \`bug report\` category items are inherently more urgent than \`feature request\`.
        * Perform semantic analysis on the \`description\` to identify keywords indicating critical issues (e.g., "crash," "data loss," "unable to login," "security flaw"). These should be given the highest urgency.
        * For features, assess the potential impact based on the problem described. Features that unblock core user journeys have a higher impact.
    * **Existing Status (10% weight):** De-prioritize items that already have a \`status\` like "planned" or "in progress", as they are already being addressed. Give the lowest priority to items marked "declined".
3.  **Define Actionable Items:**
    * **Title:** Write a clear, concise, and actionable title for the roadmap item (e.g., "Implement Password Reset via Email" instead of "can't login").
    * **Description:** Provide a brief summary of the user problem and the proposed solution.
    * **Effort & Impact Estimation:** Based on the complexity inferred from the description(s), estimate the \`estimatedEffort\` ("Small", "Medium", "Large") and the \`potentialImpact\` ("Low", "Medium", "High").
    * **Categorization:** Group the final roadmap items under logical \`epic\` categories (e.g., "Authentication", "UI/UX Enhancements", "Performance & Stability", "API Improvements").

**OUTPUT REQUIREMENTS:**

* The output **MUST** be a single, valid JSON object and nothing else. Do not include any introductory text, explanations, or markdown formatting around the JSON block.
* The root of the object should contain a single key, \`roadmap\`, which is an array of epics.
* Each item in the roadmap must link back to the original feedback posts that informed it via the \`sourceFeedbackIds\` array.

**OUTPUT JSON STRUCTURE:**

\`\`\`json
{
  "roadmap": [
    {
      "epic": "string",
      "items": [
        {
          "id": "string", // Generate a new unique identifier (uuidv4) for this roadmap item
          "title": "string",
          "description": "string",
          "type": "string", // "feature" or "bug-fix"
          "priorityScore": "number",
          "estimatedEffort": "string", // "Small", "Medium", or "Large"
          "potentialImpact": "string", // "Low", "Medium", "High"
          "sourceFeedbackIds": [
            "string" // Array of original feedback 'id's
          ]
        }
      ]
    }
  ]
}
\`\`\`

Now, process the following JSON data and generate the product roadmap.
`;

      const prompt5 = `You are an expert product manager tasked with transforming user feedback into a prioritized, actionable product roadmap. Your goal is to analyze feedback posts and create sprint-ready roadmap items that maximize user value and business impact.

## Input Format
You will receive an array of feedback posts in JSON format:
\`\`\`json
[
  {
    "id": "uuidv4",
    "title": "string",
    "description": "string",
    "upvotes": number,
    "commentCount": number,
    "status": "string|null",
    "category": "string",
    "createdAt": "string"
  }
]
\`\`\`

## Analysis Instructions
1. **Consolidate Similar Feedback**: Group related feedback items that address the same underlying need or problem
2. **Assess User Demand**: Use upvotes, comment count, and frequency of similar requests to gauge user interest
3. **Categorize by Impact**: Determine business impact (high/medium/low) based on user engagement metrics and strategic value
4. **Estimate Effort**: Assign story points (1, 2, 3, 5, 8, 13) based on implementation complexity
5. **Calculate Priority Score**: Use formula: (Impact Score × Demand Score) / Effort Score
6. **Break Down Large Items**: Split complex features into sprint-sized deliverables (max 8 story points)
7. **Focus on Completable Work**: Ensure each roadmap item can realistically be completed in a 2-week sprint

## Priority Scoring Framework
- **Impact Score**: High=5, Medium=3, Low=1
- **Demand Score**: (upvotes + commentCount) / 10, minimum 1, maximum 10
- **Effort Score**: Story points (1-13)

## Output Format
Return a JSON object with this exact structure:

\`\`\`json
{
  "roadmap": {
    "generatedAt": "ISO 8601 timestamp",
    "summary": {
      "totalItems": number,
      "highPriorityItems": number,
      "estimatedSprintsToComplete": number,
      "topUserRequests": ["string", "string", "string"]
    },
    "items": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "type": "feature" | "bug_fix" | "improvement" | "technical_debt",
        "priority": "high" | "medium" | "low",
        "priorityScore": number,
        "storyPoints": number,
        "estimatedSprintCapacity": number,
        "userImpact": {
          "impactLevel": "high" | "medium" | "low",
          "affectedUsers": "all" | "power_users" | "new_users" | "specific_segment",
          "businessValue": "string"
        },
        "implementation": {
          "complexity": "low" | "medium" | "high",
          "dependencies": ["string"],
          "risks": ["string"],
          "acceptanceCriteria": ["string"]
        },
        "sourceFeeds": [
          {
            "feedbackId": "string",
            "upvotes": number,
            "commentCount": number,
            "relevanceScore": number
          }
        ],
        "milestones": [
          {
            "name": "string",
            "description": "string",
            "deliverables": ["string"]
          }
        ]
      }
    ]
  }
}
\`\`\`

## Key Requirements
- Sort roadmap items by priority score (highest first)
- Ensure each item is actionable and has clear acceptance criteria
- Include at least 3 milestones for complex features (>5 story points)
- Reference original feedback IDs to maintain traceability
- Focus on items that can ship value incrementally
- Consider both user-facing features and necessary technical work
- Provide realistic effort estimates based on typical development team capacity

## Quality Checks
- Every roadmap item must have a clear user benefit
- Story points should reflect realistic development effort
- High-priority items should have strong user demand signals
- Technical debt items should tie back to user experience improvements
- Descriptions should be specific enough for developers to understand scope

Transform the provided feedback into a roadmap that balances user needs, business impact, and development capacity.`;

      const prompt6 = `You are an AI assistant tasked with transforming a list of feedback posts into a prioritized, actionable product roadmap consisting of features and bug fixes that can be completed in a typical sprint (2-4 weeks). The input and output are in JSON format.

### Input
The input is a list of feedback posts in JSON format, where each feedback post has the following structure:

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

### Task
Analyze the feedback posts and create a list of roadmap items. Each roadmap item should represent a feature to be implemented or a bug to be fixed, based on the feedback posts. Follow these steps:

1. **Filter Feedback Posts**: Include only feedback posts with status "under consideration", "planned", or null. Exclude those with status "in progress", "done", or "declined" to focus on future work.
2. **Group Similar Feedback**: Identify feedback posts that are related or pertain to the same feature or bug by analyzing their titles and descriptions. Use natural language processing to determine similarity (e.g., clustering or semantic analysis).
3. **Consolidate Feedback**: For each group of similar feedback posts, create a single roadmap item. Combine their titles into a concise, actionable title and merge their descriptions into a comprehensive description. Sum the upvotes and comment counts from all related feedback posts. Use the earliest createdAt timestamp for the roadmap item.
4. **Categorize Roadmap Items**:
   - For feedback posts with category "feature request", set the roadmap item type to "feature".
   - For "bug report", set the type to "bug fix".
   - For "general feedback", use your judgment to determine if it suggests a feature or bug fix. If it cannot be categorized as either, exclude it.
5. **Prioritize Roadmap Items**: Assign a priority score to each roadmap item based on:
   - **Total Upvotes**: Higher upvotes indicate greater user demand.
   - **Total Comment Counts**: More comments suggest higher engagement or importance.
   - **Recency**: More recent feedback (based on createdAt) may be more relevant. Calculate a recency score, e.g., days since the earliest createdAt, normalized or weighted appropriately.
   - **Content**: Assess the urgency or importance based on the title and description (e.g., critical bugs or highly requested features should have higher priority).
   Suggested priority formula: priority = (totalUpvotes * 1.0) + (totalComments * 0.5) + (recency_score * 0.1), where recency_score could be (current_timestamp - earliest_createdAt_in_days) inverted or normalized. Adjust weights as needed to balance factors.
6. **Sort Roadmap Items**: Order the roadmap items by priority score in descending order (highest priority first).

### Output
Return a JSON array of roadmap items, each with the following structure:

{
  "id": "uuidv4",              // Unique identifier for the roadmap item (generate a new UUID)
  "title": "string",           // Concise, actionable title for the feature or bug fix
  "description": "string",     // Detailed description, combining information from related feedback posts
  "priority": number,          // Priority score (higher means higher priority)
  "type": "feature" | "bug fix", // Type of roadmap item
  "relatedFeedbackIds": ["uuidv4", ...], // List of feedback post IDs that contributed to this item
  "totalUpvotes": number,      // Sum of upvotes from related feedback posts
  "totalComments": number,     // Sum of comment counts from related feedback posts
  "createdAt": "string"        // Earliest createdAt timestamp from related feedback posts (ISO 8601)
}

### Additional Instructions
- For bug fixes, ensure the description includes sufficient detail for developers to understand and reproduce the issue, combining relevant details from related feedback posts.
- For features, ensure the description captures the core functionality requested, combining key points from related feedback posts.
- If no feedback posts are provided or none meet the criteria, return an empty array [].
- Ensure the output is valid JSON and the roadmap items are actionable, clear, and suitable for a 2-4 week sprint.

Example Input:
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Improve search functionality",
    "description": "Search is slow and doesn't return relevant results.",
    "upvotes": 50,
    "commentCount": 20,
    "status": "under consideration",
    "category": "feature request",
    "createdAt": "2025-06-01T10:00:00Z"
  },
  {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "title": "Search bar bug",
    "description": "Search bar crashes when entering special characters.",
    "upvotes": 30,
    "commentCount": 15,
    "status": "planned",
    "category": "bug report",
    "createdAt": "2025-06-15T12:00:00Z"
  }
]

Example Output:
[
  {
    "id": "323e4567-e89b-12d3-a456-426614174002",
    "title": "Enhance Search Functionality",
    "description": "Improve search speed and relevance of results based on user feedback.",
    "priority": 55.0,
    "type": "feature",
    "relatedFeedbackIds": ["123e4567-e89b-12d3-a456-426614174000"],
    "totalUpvotes": 50,
    "totalComments": 20,
    "createdAt": "2025-06-01T10:00:00Z"
  },
  {
    "id": "423e4567-e89b-12d3-a456-426614174003",
    "title": "Fix Search Bar Crash",
    "description": "Resolve crash in search bar when special characters are entered.",
    "priority": 37.5,
    "type": "bug fix",
    "relatedFeedbackIds": ["223e4567-e89b-12d3-a456-426614174001"],
    "totalUpvotes": 30,
    "totalComments": 15,
    "createdAt": "2025-06-15T12:00:00Z"
  }
]
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
