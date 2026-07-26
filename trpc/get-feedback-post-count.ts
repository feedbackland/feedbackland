import { adminProcedure } from "@/lib/trpc";
import { getFeedbackPostCountQuery } from "@/queries/get-feedback-post-count";

/**
 * What the Ask AI page reads before the first question, so it can name the size
 * of what it is about to read instead of asking to be trusted.
 */
export const getFeedbackPostCount = adminProcedure.query(async ({ ctx }) => {
  return await getFeedbackPostCountQuery({ orgId: ctx.orgId });
});
