import { publicProcedure } from "@/lib/trpc";
import { getActiveFeedbackPostsCountQuery } from "@/queries/get-active-feedback-posts-count";

export const getActiveFeedbackPostsCount = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      return await getActiveFeedbackPostsCountQuery({
        orgId,
      });
    } catch (error) {
      throw error;
    }
  },
);
