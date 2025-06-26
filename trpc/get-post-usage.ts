import { publicProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getPostCountQuery } from "@/queries/get-post-count";
import { getPostUsageLimit } from "@/lib/utils";

export const getPostUsage = publicProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, postCount] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getPostCountQuery({ orgId }),
      ]);

      const limit = getPostUsageLimit(activeSubscription);
      const left = Number.isFinite(limit)
        ? Number(limit) - postCount
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
