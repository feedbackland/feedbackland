import "server-only";
import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { deleteCommentQuery } from "@/queries/delete-comment";

export const deleteComment = userProcedure
  .input(
    z.object({
      commentId: z.uuid(),
    }),
  )
  .mutation(async ({ input: { commentId }, ctx: { userId, sessionId } }) => {
    try {
      return await deleteCommentQuery({
        userId,

        sessionId,
        commentId,
      });
    } catch (error) {
      throw error;
    }
  });
