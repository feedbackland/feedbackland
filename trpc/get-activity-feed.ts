import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { getActivityFeedQuery } from "@/queries/get-activity-feed";
import { enforceSearchLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";
import {
  feedbackCategoriesSchema,
  feedbackOrderBySchema,
  feedbackStatusSchema,
} from "@/lib/schemas";

export const getActivityFeed = adminProcedure
  .input(
    z.object({
      cursor: z.number().min(1).nullish(),
      pageSize: z.number().min(1).max(100),
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
      categories: feedbackCategoriesSchema,
      excludeFeedback: z.boolean(),
      excludeComments: z.boolean(),
      searchValue: z.string().trim().max(500),
      unseenOnly: z.boolean(),
    }),
  )
  .query(
    async ({
      input: {
        cursor,
        pageSize,
        orderBy,
        status,
        categories,
        excludeFeedback,
        excludeComments,
        searchValue,
        unseenOnly,
      },
      ctx: { userId, ip },
    }) => {
      const page = cursor ?? 1;
      if (searchValue && !(await enforceSearchLimit(ip)).allowed)
        throw new TRPCError({ code: "TOO_MANY_REQUESTS" });

      const { items, totalItemsCount, totalPages, currentPage } =
        await getActivityFeedQuery({
          userId,
          page,
          pageSize,
          orderBy,
          status,
          categories,
          excludeFeedback,
          excludeComments,
          searchValue,
          unseenOnly,
        });

      const nextCursor = currentPage < totalPages ? currentPage + 1 : undefined;

      return {
        items,
        totalItemsCount,
        totalPages,
        currentPage,
        nextCursor,
      };
    },
  );
