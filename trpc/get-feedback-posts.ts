import "server-only";
import { z } from "zod/v4";
import { publicProcedure } from "@/lib/trpc";
import {
  feedbackOrderBySchema,
  feedbackPostsCursorSchema,
  feedbackStatusSchema,
  searchCapabilitySchema,
} from "@/lib/schemas";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";

export const getFeedbackPosts = publicProcedure
  .input(
    z.object({
      limit: z.number().int().min(1).max(100),
      cursor: feedbackPostsCursorSchema,
      orderBy: feedbackOrderBySchema,
      status: feedbackStatusSchema,
      searchValue: z.string().trim().max(500),
      capability: searchCapabilitySchema.optional(),
    }),
  )
  .query(({ input, ctx: { userId, ip, signal } }) =>
    getFeedbackPostsQuery({ ...input, userId, ip, signal }),
  );
