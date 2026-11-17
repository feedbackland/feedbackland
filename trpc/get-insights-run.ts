import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { getInsightsRun as read } from "@/lib/jobs/insights";
export const getInsightsRun = adminProcedure
  .input(
    z
      .object({
        id: z
          .string()
          .regex(/^[1-9]\d{0,18}$/)
          .refine((id) => id.length < 19 || id <= "9223372036854775807")
          .optional(),
      })
      .optional(),
  )
  .query(({ ctx, input }) =>
    read(
      { userId: ctx.userId, sessionId: ctx.sessionId },
      input?.id,
      ctx.signal,
    ),
  );
