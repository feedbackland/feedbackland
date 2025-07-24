import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { upvoteFeedbackPostQuery } from "@/queries/upvote-feedback-post";

export const upvoteFeedbackPost = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
      allowUndo: z.boolean().optional(),
    }),
  )
  .mutation(async ({ input: { postId, allowUndo }, ctx: { userId } }) => {
    try {
      return await upvoteFeedbackPostQuery({
        userId,
        postId,
        allowUndo,
      });
    } catch (error) {
      throw error;
    }
  });
