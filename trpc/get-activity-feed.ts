import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";

export const getActivityFeed = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100),
      cursor: z
        .object({
          id: z.string(),
          createdAt: z.string().datetime({ offset: true }),
        })
        .nullish(),
    }),
  )
  .query(async ({ input: { limit, cursor }, ctx: { orgId } }) => {
    try {
      const { data, nextCursor } = await getActivityFeedQuery({
        orgId,
        limit,
        cursor,
      });

      return {
        data,
        nextCursor,
      };
    } catch (error) {
      throw error;
    }
  });
