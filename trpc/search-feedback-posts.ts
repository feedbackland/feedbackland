import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { searchFeedbackPostsQuery } from "@/queries/search-feedback-posts";

export const searchFeedbackPosts = publicProcedure
  .input(
    z.object({
      searchValue: z.string().trim(),
    }),
  )
  .query(async ({ input: { searchValue }, ctx: { userId, orgId } }) => {
    try {
      return await searchFeedbackPostsQuery({
        orgId,
        userId,
        searchValue,
      });
    } catch (error) {
      throw error;
    }
  });
