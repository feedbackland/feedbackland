import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { getCommentsQuery } from "@/queries/get-comments";

export const getComments = publicProcedure
  .input(
    z.object({
      postId: z.string().uuid(),
      limit: z.number().min(1).max(100),
      cursor: z
        .object({
          id: z.string(),
          createdAt: z.string().datetime({ offset: true }),
        })
        .nullish(),
    }),
  )
  .query(async ({ input: { postId, limit, cursor }, ctx: { userId } }) => {
    try {
      const { comments, nextCursor } = await getCommentsQuery({
        postId,
        userId,
        limit,
        cursor,
      });

      return {
        comments,
        nextCursor,
      };
    } catch (error) {
      throw error;
    }
  });
