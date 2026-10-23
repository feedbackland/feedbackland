import "server-only";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "@/lib/trpc";
export const generateInsights = adminProcedure.mutation(
  async (): Promise<{ generated: number }> => {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI_NOT_CONFIGURED",
    });
  },
);
