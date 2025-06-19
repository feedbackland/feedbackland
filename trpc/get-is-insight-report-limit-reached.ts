import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getInsightReportCountQuery } from "@/queries/get-insight-report-count";

export const getIsInsightReportLimitReached = adminProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, insightReportCount] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getInsightReportCountQuery({ orgId }),
      ]);

      if (
        (activeSubscription === "free" && insightReportCount >= 1) ||
        (activeSubscription === "pro" && insightReportCount >= 1)
      ) {
        return true;
      }

      return false;
    } catch (error) {
      throw error;
    }
  },
);
