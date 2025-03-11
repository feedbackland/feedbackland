import { z } from "zod";
import { publicProcedure, userProcedure, router } from "./trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";

export const appRouter = router({
  getOrg: publicProcedure.query(async ({ ctx }) => {
    return ctx?.org || null;
  }),
  createFeedbackPost: userProcedure
    .input(
      z.object({
        description: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ input: { description }, ctx }) => {
      try {
        const authorId = ctx?.user?.uid;
        const orgId = ctx?.org?.id;

        if (!authorId || !orgId) {
          throw new Error("No authorId or orgId provided");
        }

        const feedbackPost = await createFeedbackPostQuery({
          description,
          authorId,
          orgId,
        });

        return feedbackPost;
      } catch (error) {
        throw error;
      }
    }),
  getFeedbackPosts: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        cursor: z.string().datetime({ offset: true }).nullish(),
      }),
    )
    .query(async ({ input }) => {
      const { limit, cursor } = input;
      const { feedbackPosts, nextCursor } = await getFeedbackPostsQuery({
        limit,
        cursor,
      });

      return {
        feedbackPosts,
        nextCursor,
      };
    }),
});

export type AppRouter = typeof appRouter;
