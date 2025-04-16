import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";
import { feedbackOrderBySchema, feedbackStatusSchema } from "@/lib/schemas";

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
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
    }),
  )
  .query(
    async ({ input: { limit, cursor, orderBy, status }, ctx: { orgId } }) => {
      try {
        const { data, nextCursor } = await getActivityFeedQuery({
          orgId,
          limit,
          cursor,
          orderBy,
          status,
        });

        return {
          data,
          nextCursor,
        };
      } catch (error) {
        throw error;
      }
    },
  );
