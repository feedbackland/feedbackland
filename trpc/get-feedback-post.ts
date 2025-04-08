import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { getFeedbackPostQuery } from "@/queries/get-feedback-post";

export const getFeedbackPost = publicProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
    }),
  )
  .query(async ({ input: { postId }, ctx: { userId } }) => {
    try {
      return await getFeedbackPostQuery({
        postId,
        userId,
      });
    } catch (error) {
      throw error;
    }
  });
