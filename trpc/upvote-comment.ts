import { z } from "zod/v4";
import { userProcedure } from "@/lib/trpc";
import { upvoteCommentQuery } from "@/queries/upvote-comment";

export const upvoteComment = userProcedure
  .input(
    z.object({
      commentId: z.uuid(),
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
