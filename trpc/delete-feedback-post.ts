import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { deleteFeedbackPostQuery } from "@/queries/delete-feedback-post";

export const deleteFeedbackPost = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
    }),
  )
  .mutation(async ({ input: { postId }, ctx: { userId, orgId } }) => {
    try {
      return await deleteFeedbackPostQuery({
        userId,
        orgId,
        postId,
      });
    } catch (error) {
      throw error;
    }
  });
