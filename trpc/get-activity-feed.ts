import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";
import { feedbackOrderBySchema, feedbackStatusSchema } from "@/lib/schemas";

export const getActivityFeed = adminProcedure
  .input(
    z.object({
      page: z.number().min(1),
      pageSize: z.number().min(1).max(100),
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
    }),
  )
  .query(
    async ({ input: { page, pageSize, orderBy, status }, ctx: { orgId } }) => {
      try {
        const { items, count, totalPages, currentPage } =
          await getActivityFeedQuery({
            orgId,
            page,
            pageSize,
            orderBy,
            status,
          });

        return {
          items,
          count,
          totalPages,
          currentPage,
        };
      } catch (error) {
        throw error;
      }
    },
  );
