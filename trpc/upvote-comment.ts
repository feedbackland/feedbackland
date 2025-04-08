import { z } from "zod";
import { userProcedure } from "@/lib/trpc";
import { upvoteCommentQuery } from "@/queries/upvote-comment";

export const upvoteComment = userProcedure
  .input(
    z.object({
      commentId: z.string().uuid(),
      allowUndo: z.boolean().optional(),
    }),
  )
  .mutation(async ({ input: { commentId, allowUndo }, ctx: { userId } }) => {
    try {
      return await upvoteCommentQuery({
        userId,
        commentId,
        allowUndo,
      });
    } catch (error) {
      throw error;
    }
  });
