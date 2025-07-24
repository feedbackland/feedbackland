import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import { getCommentsQuery } from "@/queries/get-comments";

export const getComments = publicProcedure
  .input(
    z.object({
      postId: z.uuid(),
      limit: z.number().min(1).max(100),
      cursor: z
        .object({
          id: z.string(),
          createdAt: z.string().datetime({ offset: true }),
        })
        .nullish(),
    }),
  )
  .query(
    async ({ input: { postId, limit, cursor }, ctx: { orgId, userId } }) => {
      try {
        const { comments, nextCursor } = await getCommentsQuery({
          orgId,
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
    },
  );
