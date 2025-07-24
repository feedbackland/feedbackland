import { z } from "zod/v4";
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
      searchValue: z.string().trim(),
    }),
  )
  .query(
    async ({
      input: { limit, cursor, orderBy, status, searchValue },
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
          searchValue,
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
