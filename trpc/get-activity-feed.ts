import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";
import {
  feedbackCategoriesSchema,
  feedbackOrderBySchema,
  feedbackStatusSchema,
} from "@/lib/schemas";

export const getActivityFeed = adminProcedure
  .input(
    z.object({
      page: z.number().min(1),
      pageSize: z.number().min(1).max(100),
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
      categories: feedbackCategoriesSchema,
      excludeFeedback: z.boolean(),
      excludeComments: z.boolean(),
      searchValue: z.string().trim(),
    }),
  )
  .query(
    async ({
      input: {
        page,
        pageSize,
        orderBy,
        status,
        categories,
        excludeFeedback,
        excludeComments,
        searchValue,
      },
      ctx: { orgId, userId },
    }) => {
      try {
        const { items, totalItemsCount, totalPages, currentPage } =
          await getActivityFeedQuery({
            orgId,
            userId,
            page,
            pageSize,
            orderBy,
            status,
            categories,
            excludeFeedback,
            excludeComments,
            searchValue,
          });

        return {
          items,
          totalItemsCount,
          totalPages,
          currentPage,
        };
      } catch (error) {
        throw error;
      }
    },
  );
