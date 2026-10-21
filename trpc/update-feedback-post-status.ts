import "server-only";
import { z } from "zod/v4";
import { adminProcedure } from "@/lib/trpc";
import { updateFeedbackPostStatusQuery } from "@/queries/update-feedback-post-status";
import { feedbackStatusSchema } from "@/lib/schemas";

export const updateFeedbackPostStatus = adminProcedure
  .input(
    z.object({
      postId: z.uuid(),
      status: feedbackStatusSchema,
    }),
  )
  .mutation(
    async ({ input: { postId, status }, ctx: { userId, sessionId } }) => {
      try {
        const updatedPost = await updateFeedbackPostStatusQuery({
          postId,
          userId,

          sessionId,
          status,
        });

        return updatedPost;
      } catch (error) {
        throw error;
      }
    },
  );
