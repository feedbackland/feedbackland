import { publicProcedure } from "@/lib/trpc";
import { getActiveFeedbackPostCountQuery } from "@/queries/get-active-feedback-post-count";

export const getActiveFeedbackPostCount = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      return await getActiveFeedbackPostCountQuery({
        orgId,
      });
    } catch (error) {
      throw error;
    }
  },
);
