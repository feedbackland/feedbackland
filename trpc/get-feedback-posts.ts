import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import { feedbackOrderBySchema } from "@/lib/schemas";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";

export const getFeedbackPosts = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100),
      cursor: z
        .object({
          id: z.string(),
          createdAt: z.string().datetime({ offset: true }),
        })
        .nullish(),
      orderBy: feedbackOrderBySchema,
    }),
  )
  .query(
    async ({ input: { limit, cursor, orderBy }, ctx: { userId, orgId } }) => {
      try {
        const { feedbackPosts, nextCursor } = await getFeedbackPostsQuery({
          orgId,
          userId,
          limit,
          cursor,
          orderBy,
        });

        return {
          feedbackPosts,
          nextCursor,
        };
      } catch (error) {
        throw error;
      }
    },
  );
