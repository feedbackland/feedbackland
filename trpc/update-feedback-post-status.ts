import { z } from "zod";
import { adminProcedure } from "@/lib/trpc";
import { updateFeedbackPostStatusQuery } from "@/queries/update-feedback-post-status";
import { feedbackStatusSchema } from "@/lib/schemas";

export const updateFeedbackPostStatus = adminProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
      status: feedbackStatusSchema,
    }),
  )
  .mutation(async ({ input: { postId, status }, ctx: { orgId, userId } }) => {
    try {
      const updatedPost = await updateFeedbackPostStatusQuery({
        postId,
        userId,
        status,
        orgId,
      });

      return updatedPost;
    } catch (error) {
      throw error;
    }
  });
