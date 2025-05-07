import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllFeedbackPostsForOrgQuery,
  FeedbackPostInsightData,
} from "@/queries/getAllFeedbackPostsForOrg";

// Ensure you have OPENROUTER_API_KEY in your .env.local
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// We'll use a specific Gemini model available through OpenRouter.
// You can find model names on the OpenRouter documentation.
// Example: "google/gemini-pro" or "google/gemini-flash"
const MODEL_NAME = "google/gemini-2.5-flash-preview";

export const generateInsights = userProcedure
  .input(
    z.object({
      prompt: z.string().min(1, "Prompt cannot be empty."),
      // Optional: include organization ID if insights should be org-specific
      // orgId: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!OPENROUTER_API_KEY) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your environment variables.",
      });
    }

    try {
      if (!ctx.orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization ID is missing. Cannot generate insights.",
        });
      }

      let feedbackPosts: FeedbackPostInsightData[] = [];
      try {
        feedbackPosts = await getAllFeedbackPostsForOrgQuery({
          orgId: ctx.orgId,
        });
      } catch (dbError) {
        console.error(
          "Database error fetching feedback posts for insights:",
          dbError,
        );
        // Decide if you want to proceed with an empty context or throw an error
        // For now, we'll proceed with a message indicating data couldn't be fetched.
      }

      let feedbackContext =
        "No feedback data available or failed to fetch feedback data for the organization.";
      if (feedbackPosts.length > 0) {
        // Simple formatting. You might want to make this more sophisticated.
        // Consider token limits for the AI model. Truncate or summarize if necessary.
        feedbackContext =
          "Feedback Posts:\n" +
          feedbackPosts
            .map(
              (post) =>
                `- Title: ${post.title || "N/A"}\n  Description: ${post.description ? post.description.substring(0, 200) + (post.description.length > 200 ? "..." : "") : "N/A"}\n  Upvotes: ${post.upvotes}\n  Status: ${post.status || "N/A"}\n  Created: ${post.createdAt.toLocaleDateString()}`,
            )
            .join("\n\n");

        // Basic check for context length to avoid overly large prompts
        if (feedbackContext.length > 15000) {
          // Adjust this limit as needed
          feedbackContext =
            feedbackContext.substring(0, 15000) +
            "\n\n[Feedback data truncated due to length]";
        }
      }

      const fullPrompt = `
User's question: "${input.prompt}"

Please answer the user's question based on the following feedback data from the platform.
Provide a concise and helpful answer that is well formatted, clutter free, to the point and easily readable. Try to avoid symbols like '**'.

--- Platform Feedback Data ---
${feedbackContext}
--- End of Platform Feedback Data ---

Answer:
      `;

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          // Recommended by OpenRouter:
          // "HTTP-Referer": `YOUR_SITE_URL`, // Replace with your actual site URL
          // "X-Title": `YOUR_SITE_NAME`, // Replace with your actual site name
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [{ role: "user", content: fullPrompt }],
          // You can add other parameters like temperature, max_tokens, etc.
          // temperature: 0.7,
          // max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("OpenRouter API Error:", response.status, errorBody);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get insights from OpenRouter. Status: ${response.status}. Details: ${errorBody}`,
        });
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return {
          insight: data.choices[0].message.content,
        };
      } else {
        console.error("OpenRouter API - Unexpected response structure:", data);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Received an unexpected response structure from OpenRouter.",
        });
      }
    } catch (error) {
      console.error("Error in generateInsights mutation:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred while generating insights.",
      });
    }
  });
