import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedbackPostsCountQuery } from "@/queries/get-active-feedback-posts-count";

export const getActivityFeedbackPostsCount = adminProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      return await getActivityFeedbackPostsCountQuery({
        orgId,
      });
    } catch (error) {
      throw error;
    }
  },
);
