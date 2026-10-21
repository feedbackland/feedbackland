import "server-only";
import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { deleteFeedbackPostQuery } from "@/queries/delete-feedback-post";

export const deleteFeedbackPost = userProcedure
  .input(
    z.object({
      postId: z.uuid(),
    }),
  )
  .mutation(async ({ input: { postId }, ctx: { userId, sessionId } }) => {
    try {
      return await deleteFeedbackPostQuery({
        userId,

        sessionId,
        postId,
      });
    } catch (error) {
      throw error;
    }
  });
