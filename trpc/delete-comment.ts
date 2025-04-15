import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { deleteCommentQuery } from "@/queries/delete-comment";

export const deleteComment = userProcedure
  .input(
    z.object({
      commentId: z.string().uuid(),
    }),
  )
  .mutation(async ({ input: { commentId }, ctx: { userId, orgId } }) => {
    try {
      return await deleteCommentQuery({
        userId,
        orgId,
        commentId,
      });
    } catch (error) {
      throw error;
    }
  });
