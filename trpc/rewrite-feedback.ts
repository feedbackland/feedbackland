import "server-only";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "@/lib/trpc";
export const rewriteFeedback = publicProcedure
  .input(z.object({ description: z.string().trim().min(1).max(10000) }))
  .mutation(async (): Promise<{ description: string }> => {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI_NOT_CONFIGURED",
    });
  });
