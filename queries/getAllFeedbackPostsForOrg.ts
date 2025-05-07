"server-only";

import { db } from "@/db/db";
import { sql } from "kysely";

// Define a simpler type for the feedback posts we need for insights
export type FeedbackPostInsightData = {
  id: string;
  title: string | null;
  description: string | null;
  upvotes: number;
  status: string | null; // Assuming status is a string, adjust if it's an enum or different type
  createdAt: Date;
  // Add any other fields you deem relevant for AI context
};

export const getAllFeedbackPostsForOrgQuery = async ({
  orgId,
}: {
  orgId: string;
}): Promise<FeedbackPostInsightData[]> => {
  try {
    // Simplified query to get all feedback posts for an org
    // We might want to limit the number of posts or the length of descriptions
    // if the total data size becomes too large for the AI prompt.
    // For now, let's fetch all.
    const feedbackPosts = await db
      .selectFrom("feedback")
      .where("feedback.orgId", "=", orgId)
      .select([
        "feedback.id",
        "feedback.title",
        "feedback.description",
        "feedback.upvotes",
        "feedback.status",
        "feedback.createdAt",
      ])
      .orderBy("feedback.createdAt", "desc") // Optional: order by newest
      .execute();

    // Ensure the structure matches FeedbackPostInsightData, especially for upvotes
    return feedbackPosts.map((post) => ({
      ...post,
      upvotes: Number(post.upvotes) || 0, // Ensure upvotes is a number
    })) as FeedbackPostInsightData[];
  } catch (error: any) {
    console.error("Error in getAllFeedbackPostsForOrgQuery:", error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to retrieve all feedback posts for org. Reason: ${reason}`,
    );
  }
};
