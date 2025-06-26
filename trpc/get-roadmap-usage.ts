import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getRoadmapCountQuery } from "@/queries/get-roadmap-count";
import { getRoadmapUsageLimit } from "@/lib/utils";

export const getRoadmapUsage = adminProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, roadmapCount] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getRoadmapCountQuery({ orgId }),
      ]);

      const limit = getRoadmapUsageLimit(activeSubscription);
      const left = Number.isFinite(limit)
        ? Number(limit) - roadmapCount
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
