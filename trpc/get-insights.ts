import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { insightsCursorSchema } from "@/lib/schemas";
import { getInsightsQuery } from "@/queries/get-insights";

export const getInsights = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100),
      cursor: insightsCursorSchema,
    }),
  )
  .query(async ({ input: { limit, cursor }, ctx: { orgId } }) => {
    try {
      const { items, nextCursor } = await getInsightsQuery({
        orgId,
        limit,
        cursor,
      });

      return {
        items,
        nextCursor,
      };
    } catch (error) {
      throw error;
    }
  });
