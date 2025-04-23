import { z } from "zod";
import { publicProcedure } from "@/lib/trpc";
import {
  feedbackOrderBySchema,
  feedbackPostsCursorSchema,
  feedbackStatusSchema,
} from "@/lib/schemas";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";

export const getFeedbackPosts = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100),
      cursor: feedbackPostsCursorSchema,
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
    }),
  )
  .query(
    async ({
      input: { limit, cursor, orderBy, status },
      ctx: { userId, orgId },
    }) => {
      try {
        const { feedbackPosts, nextCursor } = await getFeedbackPostsQuery({
          orgId,
          userId,
          limit,
          cursor,
          orderBy,
          status,
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
