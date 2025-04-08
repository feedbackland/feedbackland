import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { getCommentQuery } from "@/queries/get-comment";

export const getComment = publicProcedure
  .input(
    z.object({
      commentId: z.string().uuid(),
    }),
  )
  .query(async ({ input: { commentId }, ctx: { userId } }) => {
    try {
      return await getCommentQuery({
        commentId,
        userId,
      });
    } catch (error) {
      throw error;
    }
  });
