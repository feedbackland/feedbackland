import { z } from "zod";
import { publicProcedure, userProcedure, router } from "@/lib/trpc";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";
import { upvoteFeedbackPostQuery } from "@/queries/upvote-feedback-post";
import { getFeedbackPostQuery } from "@/queries/get-feedback-post";
import { createCommentQuery } from "@/queries/create-comment";
import { getCommentsQuery } from "@/queries/get-comments";
import { getCommentQuery } from "@/queries/get-comment";
import { feedbackOrderBySchema } from "@/lib/schemas";
import { searchFeedbackPosts } from "./search-feedback-posts";
import { updateFeedbackPostStatus } from "./update-feedback-post-status";
import { upvoteComment } from "./upvote-comment";
import { getMentionableUsers } from "./get-mentionable-users";
import { getOrg } from "./get-org";
import { claimOrg } from "./claim-org";
import { createFeedbackPost } from "./create-feedback-post";

export const appRouter = router({
  searchFeedbackPosts,
  updateFeedbackPostStatus,
  upvoteComment,
  getMentionableUsers,
  getOrg,
  claimOrg,
  createFeedbackPost,
  upvoteFeedbackPost: userProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        allowUndo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input: { postId, allowUndo }, ctx: { userId } }) => {
      try {
        return await upvoteFeedbackPostQuery({
          userId,
          postId,
          allowUndo,
        });
      } catch (error) {
        throw error;
      }
    }),
  getFeedbackPosts: publicProcedure
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
    ),
  getFeedbackPost: publicProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
      }),
    )
    .query(async ({ input: { postId }, ctx: { userId } }) => {
      try {
        return await getFeedbackPostQuery({
          postId,
          userId,
        });
      } catch (error) {
        throw error;
      }
    }),
  createComment: userProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        parentCommentId: z.string().uuid().nullable(),
        content: z.string().trim().min(1),
      }),
    )
    .mutation(
      async ({
        input: { postId, parentCommentId, content },
        ctx: { userId },
      }) => {
        try {
          return await createCommentQuery({
            content,
            authorId: userId,
            postId,
            parentCommentId,
          });
        } catch (error) {
          throw error;
        }
      },
    ),
  getComment: publicProcedure
    .input(
      z.object({
        commentId: z.string().uuid(),
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
    }),
  getComments: publicProcedure
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
    }),
});

export type AppRouter = typeof appRouter;
