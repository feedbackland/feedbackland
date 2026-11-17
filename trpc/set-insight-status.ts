import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { feedbackStatusSchema } from "@/lib/schemas";
import { setInsightStatusQuery } from "@/queries/set-insight-status";

export const setInsightStatus = adminProcedure
  .input(
    z.object({
      insightId: z.uuid(),
      version: z.uuid(),
      status: feedbackStatusSchema,
    }),
  )
  .mutation(({ input, ctx: { userId, sessionId, signal } }) =>
    setInsightStatusQuery({ ...input, userId, sessionId, signal }),
  );
