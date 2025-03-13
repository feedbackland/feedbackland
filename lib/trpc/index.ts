import { z } from "zod";
import { publicProcedure, userProcedure, router } from "./trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";
import { upvoteFeedbackPostQuery } from "@/queries/upvote-feedback-post";
import { getUserUpvoteQuery } from "@/queries/get-user-upvote";
import { getFeedbackPost } from "@/queries/get-feedback-post";

export const appRouter = router({
  getOrg: publicProcedure.query(async ({ ctx }) => {
    return ctx?.org || null;
  }),
  getUserUpvote: publicProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
      }),
    )
    .query(async ({ input: { postId }, ctx }) => {
      try {
        const userId = ctx?.user?.uid;

        if (userId && postId) {
          return await getUserUpvoteQuery({ userId, postId });
        }

        return null;
      } catch (error) {
        throw error;
      }
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
  upvoteFeedbackPost: userProcedure
    .input(
      z.object({
        feedbackPostId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input: { feedbackPostId }, ctx }) => {
      try {
        const userId = ctx?.user?.uid;

        if (!userId) {
          throw new Error("No userId");
        }

        if (!feedbackPostId) {
          throw new Error("No feedbackPostId");
        }

        const feedbackPost = await upvoteFeedbackPostQuery({
          userId,
          feedbackPostId,
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
    .query(async ({ input: { limit, cursor }, ctx }) => {
      const orgId = ctx?.org?.id;
      const userId = ctx?.user?.uid || null;

      if (!orgId) {
        throw new Error("No orgId");
      }

      const { feedbackPosts, nextCursor } = await getFeedbackPostsQuery({
        orgId,
        userId,
        limit,
        cursor,
      });

      return {
        feedbackPosts,
        nextCursor,
      };
    }),
  getFeedbackPost: publicProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
      }),
    )
    .query(async ({ input: { postId }, ctx }) => {
      const userId = ctx?.user?.uid || null;

      return await getFeedbackPost({
        postId,
        userId,
      });
    }),
});

export type AppRouter = typeof appRouter;
