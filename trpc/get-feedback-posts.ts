import "server-only";
import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import {
  feedbackOrderBySchema,
  feedbackPostsCursorSchema,
  feedbackStatusSchema,
} from "@/lib/schemas";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";
import { enforceSearchLimit } from "@/lib/rate-limit";
import { TRPCError } from "@trpc/server";

export const getFeedbackPosts = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100),
      cursor: feedbackPostsCursorSchema,
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
      searchValue: z.string().trim().max(500),
    }),
  )
  .query(
    async ({
      input: { limit, cursor, orderBy, status, searchValue },
      ctx: { userId, ip },
    }) => {
      try {
        if (searchValue && !(await enforceSearchLimit(ip)).allowed)
          throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
        const { feedbackPosts, nextCursor } = await getFeedbackPostsQuery({
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
