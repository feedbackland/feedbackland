import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { searchActivityFeedQuery } from "@/queries/search-activity-feed";
import { feedbackCategoriesSchema } from "@/lib/schemas";

export const searchActivityFeed = adminProcedure
  .input(
    z.object({
      searchValue: z.string().trim(),
      page: z.number().min(1),
      pageSize: z.number().min(1).max(100),
      categories: feedbackCategoriesSchema,
      excludeFeedback: z.boolean(),
      excludeComments: z.boolean(),
    }),
  )
  .query(
    async ({
      input: {
        searchValue,
        page,
        pageSize,
        categories,
        excludeFeedback,
        excludeComments,
      },
      ctx: { orgId },
    }) => {
      try {
        return await searchActivityFeedQuery({
          orgId,
          searchValue,
          page,
          pageSize,
          categories,
          excludeFeedback,
          excludeComments,
        });
      } catch (error) {
        throw error;
      }
    },
  );
