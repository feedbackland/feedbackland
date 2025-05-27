import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { insightsCursorSchema } from "@/lib/schemas";
import { getInsightsQuery, getAllInsightsQuery } from "@/queries/get-insights"; // Import getAllInsightsQuery

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

export const getAllInsights = adminProcedure
  .input(z.object({}))
  .query(async ({ ctx: { orgId } }) => {
    try {
      const insights = await getAllInsightsQuery({ orgId });
      return insights;
    } catch (error) {
      throw error;
    }
  });
