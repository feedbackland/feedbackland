import { publicProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getActiveFeedbackPostCountQuery } from "@/queries/get-active-feedback-post-count";

export const getIsPostLimitReached = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, postCount] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getActiveFeedbackPostCountQuery({ orgId }),
      ]);

      if (
        (activeSubscription === "free" && postCount >= 75) ||
        (activeSubscription === "pro" && postCount >= 500)
      ) {
        return true;
      }

      return false;
    } catch (error) {
      throw error;
    }
  },
);
