import { adminProcedure } from "@/lib/trpc";
import { getSubscriptionQuery } from "@/queries/get-subscription";
import { getInsightReportCountQuery } from "@/queries/get-insight-report-count";

const getRoadmapsLimit = (activeSubscription: string) => {
  if (activeSubscription === "free") {
    return 3;
  } else if (activeSubscription === "pro") {
    return 20;
  }

  return null;
};

export const getIsInsightReportLimitReached = adminProcedure.query(
  async ({ ctx: { orgId } }) => {
    try {
      const [{ activeSubscription }, insightReportCount] = await Promise.all([
        getSubscriptionQuery({ orgId }),
        getInsightReportCountQuery({ orgId }),
      ]);

      const roadmapsLimit = getRoadmapsLimit(activeSubscription);
      const roadmapsLeft = !!(
        roadmapsLimit && Number.isFinite(insightReportCount)
      )
        ? roadmapsLimit - insightReportCount
        : null;
      const exhausted = roadmapsLeft === 0;

      return {
        exhausted,
        roadmapsLimit,
        roadmapsLeft,
      };
    } catch (error) {
      throw error;
    }
  },
);
