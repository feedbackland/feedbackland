import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { feedbackStatusSchema } from "@/lib/schemas";
import { setInsightStatusQuery } from "@/queries/set-insight-status";

export const setInsightStatus = adminProcedure
  .input(
    z.object({
      insightId: z.uuid(),
      status: feedbackStatusSchema,
    }),
  )
  .mutation(async ({ input: { insightId, status }, ctx: { orgId } }) => {
    return await setInsightStatusQuery({ orgId, insightId, status });
  });
