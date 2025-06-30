import { publicProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getActivePostCountQuery } from "@/queries/get-active-post-count";
import { analyzablePostLimit } from "@/lib/utils";

export const getAnalyzablePostLimit = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, activePostCount] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getActivePostCountQuery({ orgId }),
      ]);

      const limit = analyzablePostLimit(activeSubscription);
      const left = Number.isFinite(limit)
        ? Number(limit) - activePostCount
        : undefined;
      const limitReached = Number(left) <= 0;

      return {
        limit,
        limitReached,
        left,
      };
    } catch (error) {
      throw error;
    }
  },
);
