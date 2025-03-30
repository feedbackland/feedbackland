import { z } from "zod";
import { publicProcedure, userProcedure, adminProcedure, router } from "./trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";
import { upvoteFeedbackPostQuery } from "@/queries/upvote-feedback-post";
import { getUserUpvoteQuery } from "@/queries/get-user-upvote";
import { getFeedbackPostQuery } from "@/queries/get-feedback-post";
import { searchFeedbackPostsQuery } from "@/queries/search-feedback-posts";
import { createCommentQuery } from "@/queries/create-comment";
import { getCommentsQuery } from "@/queries/get-comments";
import { upvoteCommentQuery } from "@/queries/upvote-comment";
import { getCommentQuery } from "@/queries/get-comment";
import { getMentionableUsersQuery } from "@/queries/get-mentionable-users";
import { upsertUserQuery } from "@/queries/upsert-user";
import { feedbackStatusSchema } from "@/lib/schemas";
import { updateFeedbackPostStatusQuery } from "@/queries/update-feedback-post-status";
import { feedbackOrderBySchema } from "../schemas";

export const appRouter = router({
  upsertUser: userProcedure
    .input(
      z.object({
        name: z.string().min(1).nullable(),
        email: z.string().email().nullable(),
        photoURL: z.string().min(1).nullable(),
      }),
    )
    .mutation(
      async ({ input: { name, email, photoURL }, ctx: { userId, orgId } }) => {
        try {
          return await upsertUserQuery({
            userId,
            orgId,
            email,
            name,
            photoURL,
          });
        } catch (error) {
          throw error;
        }
      },
    ),
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
  getUserUpvote: publicProcedure
    .input(
      z.object({
        contentId: z.string().uuid(),
      }),
    )
    .query(async ({ input: { contentId }, ctx: { userId } }) => {
      try {
        return await getUserUpvoteQuery({ userId, contentId });
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
  searchFeedbackPosts: publicProcedure
    .input(
      z.object({
        searchValue: z.string().trim(),
      }),
    )
    .query(async ({ input: { searchValue }, ctx: { userId, orgId } }) => {
      try {
        return await searchFeedbackPostsQuery({
          orgId,
          userId,
          searchValue,
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
