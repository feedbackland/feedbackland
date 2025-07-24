import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import { getCommentQuery } from "@/queries/get-comment";

export const getComment = publicProcedure
  .input(
    z.object({
      commentId: z.uuid(),
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
