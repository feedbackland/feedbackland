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

      let status = false;
      let reportsLeft: number | null = null;

      if (activeSubscription === "free" || activeSubscription === "pro") {
        const totalReports = activeSubscription === "free" ? 2 : 20;
        reportsLeft = totalReports - insightReportCount;
        status = reportsLeft <= 0;
      }

      return {
        status,
        reportsLeft,
      };
    } catch (error) {
      throw error;
    }
  },
);
