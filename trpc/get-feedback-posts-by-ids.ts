import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import { getFeedbackPostsByIdsQuery } from "@/queries/get-feedback-posts-by-ids";

export const getFeedbackPostsByIds = publicProcedure
  .input(
    z.object({
      ids: z.array(z.string()).min(1),
    }),
  )
  .query(async ({ input: { ids } }) => {
    try {
      const feedbackPosts = await getFeedbackPostsByIdsQuery({ ids });
      return feedbackPosts;
    } catch (error) {
      throw error;
    }
  });
