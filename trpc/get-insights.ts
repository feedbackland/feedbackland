import { adminProcedure } from "@/lib/trpc";
import { getInsightsQuery } from "@/queries/get-insights";

/**
 * The insights is capped at a few dozen insights and every one of them is needed
 * to rank, filter and export the list, so it is fetched whole. Paging it would
 * only make client-side sorting and search silently wrong.
 */
export const getInsights = adminProcedure.query(async ({ ctx }) => {
  return await getInsightsQuery({ orgId: ctx.orgId });
});
