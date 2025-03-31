import { z } from "zod";
import {
  publicProcedure,
  userProcedure,
  adminProcedure,
  router,
} from "@/lib/trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";
import { upvoteFeedbackPostQuery } from "@/queries/upvote-feedback-post";
import { getFeedbackPostQuery } from "@/queries/get-feedback-post";
import { createCommentQuery } from "@/queries/create-comment";
import { getCommentsQuery } from "@/queries/get-comments";
import { upvoteCommentQuery } from "@/queries/upvote-comment";
import { getCommentQuery } from "@/queries/get-comment";
import { getMentionableUsersQuery } from "@/queries/get-mentionable-users";
import { feedbackStatusSchema } from "@/lib/schemas";
import { updateFeedbackPostStatusQuery } from "@/queries/update-feedback-post-status";
import { feedbackOrderBySchema } from "@/lib/schemas";
import { claimOrgQuery } from "@/queries/claim-org";
import { searchFeedbackPosts } from "./search-feedback-posts";

export const appRouter = router({
  getMentionableUsers: publicProcedure
    .input(
      z.object({
        searchValue: z.string(),
      }),
    )
    .query(async ({ input: { searchValue }, ctx: { orgId } }) => {
      try {
        const users = await getMentionableUsersQuery({
          orgId,
          searchValue,
        });

        return users
          .filter(({ name }) => name && name.length > 0)
          .map(({ id, name }) => ({
            id,
            name,
          })) as [{ id: string; name: string }];
      } catch (error) {
        throw error;
      }
    }),
  getOrg: publicProcedure.query(
    async ({ ctx: { orgId, orgName, orgSubdomain, orgIsClaimed } }) => {
      return {
        orgId,
        orgName,
        orgSubdomain,
        orgIsClaimed,
      };
    },
  ),
  claimOrg: userProcedure.mutation(async ({ ctx: { userId, orgId } }) => {
    try {
      return await claimOrgQuery({
        userId,
        orgId,
      });
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
    .mutation(async ({ input: { description }, ctx: { userId, orgId } }) => {
      try {
        return await createFeedbackPostQuery({
          description,
          authorId: userId,
          orgId,
        });
      } catch (error) {
        throw error;
      }
    }),
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
  searchFeedbackPosts,
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
  upvoteComment: userProcedure
    .input(
      z.object({
        commentId: z.string().uuid(),
        allowUndo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input: { commentId, allowUndo }, ctx: { userId } }) => {
      try {
        return await upvoteCommentQuery({
          userId,
          commentId,
          allowUndo,
        });
      } catch (error) {
        throw error;
      }
    }),
  updateFeedbackPostStatus: adminProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        status: feedbackStatusSchema,
      }),
    )
    .mutation(async ({ input: { postId, status }, ctx: { orgId } }) => {
      try {
        const updatedPost = await updateFeedbackPostStatusQuery({
          postId,
          status,
          orgId,
        });

        return updatedPost;
      } catch (error) {
        throw error;
      }
    }),
});

export type AppRouter = typeof appRouter;
