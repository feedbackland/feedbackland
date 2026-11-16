import "server-only";
import { adminProcedure } from "@/lib/trpc";
import { startInsightsRun as start } from "@/lib/jobs/insights";
export const startInsightsRun = adminProcedure.mutation(({ ctx }) =>
  start({ userId: ctx.userId, sessionId: ctx.sessionId }, ctx.signal),
);
