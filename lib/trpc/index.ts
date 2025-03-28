import { z } from "zod";
import { publicProcedure, userProcedure, router } from "./trpc";
import { createFeedbackPostQuery } from "@/queries/create-feedback-post";
import { getFeedbackPostsQuery } from "@/queries/get-feedback-posts";
import { upvoteFeedbackPostQuery } from "@/queries/upvote-feedback-post";
import { getUserUpvoteQuery } from "@/queries/get-user-upvote";
import { getFeedbackPost } from "@/queries/get-feedback-post";
import { searchFeedbackPostsQuery } from "@/queries/search-feedback-posts";
import { createCommentQuery } from "@/queries/create-comment";
import { getCommentsQuery } from "@/queries/get-comments";
import { upvoteCommentQuery } from "@/queries/upvote-comment";
import { getCommentQuery } from "@/queries/get-comment";
import { getMentionableUsersQuery } from "@/queries/get-mentionable-users";
import { upsertUserQuery } from "@/queries/upsert-user";

export const appRouter = router({
  upsertUser: userProcedure
    .input(
      z.object({
        name: z.string().min(1).nullable(),
        email: z.string().email().nullable(),
        photoURL: z.string().min(1).nullable(),
      }),
    )
    .mutation(async ({ input: { name, email, photoURL }, ctx }) => {
      try {
        const userId = ctx?.user?.uid;
        const orgId = ctx?.org?.id;

        if (!userId || !orgId) {
          throw new Error("No userId or orgId");
        }

        const user = await upsertUserQuery({
          userId,
          orgId,
          email,
          name,
          photoURL,
        });

        return user;
      } catch (error) {
        throw error;
      }
    }),
  getMentionableUsers: publicProcedure
    .input(
      z.object({
        searchValue: z.string(),
      }),
    )
    .query(async ({ input: { searchValue }, ctx }) => {
      const orgId = ctx?.org?.id;

      if (!orgId) {
        throw new Error("No orgId provided");
      }

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
    }),
  getOrg: publicProcedure.query(async ({ ctx }) => {
    return ctx?.org || null;
  }),
  getUserUpvote: publicProcedure
    .input(
      z.object({
        contentId: z.string().uuid(),
      }),
    )
    .query(async ({ input: { contentId }, ctx }) => {
      try {
        const userId = ctx?.user?.uid;

        if (userId && contentId) {
          return await getUserUpvoteQuery({ userId, contentId });
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
        postId: z.string().uuid(),
        allowUndo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input: { postId, allowUndo }, ctx }) => {
      try {
        const userId = ctx?.user?.uid;

        if (!userId) {
          throw new Error("No userId");
        }

        if (!postId) {
          throw new Error("No postId");
        }

        const feedbackPost = await upvoteFeedbackPostQuery({
          userId,
          postId,
          allowUndo,
        });

        return feedbackPost;
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
    .query(async ({ input: { searchValue }, ctx }) => {
      const orgId = ctx?.org?.id;
      const userId = ctx?.user?.uid || null;

      if (!orgId) {
        throw new Error("No orgId");
      }

      const result = await searchFeedbackPostsQuery({
        orgId,
        userId,
        searchValue,
      });

      return result;
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
        orderBy: z.enum(["newest", "upvotes", "comments"]),
      }),
    )
    .query(async ({ input: { limit, cursor, orderBy }, ctx }) => {
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
        orderBy,
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
  createComment: userProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        parentCommentId: z.string().uuid().nullable(),
        content: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ input: { postId, parentCommentId, content }, ctx }) => {
      try {
        const authorId = ctx?.user?.uid;

        if (!authorId) {
          throw new Error("No authorId provided");
        }

        const comment = await createCommentQuery({
          content,
          authorId,
          postId,
          parentCommentId,
        });

        return comment;
      } catch (error) {
        throw error;
      }
    }),
  getComment: publicProcedure
    .input(
      z.object({
        commentId: z.string().uuid(),
      }),
    )
    .query(async ({ input: { commentId }, ctx }) => {
      const userId = ctx?.user?.uid || null;

      return await getCommentQuery({
        commentId,
        userId,
      });
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
    .query(async ({ input: { postId, limit, cursor }, ctx }) => {
      const orgId = ctx?.org?.id;
      const userId = ctx?.user?.uid || null;

      if (!orgId) {
        throw new Error("No orgId");
      }

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
    }),
  upvoteComment: userProcedure
    .input(
      z.object({
        commentId: z.string().uuid(),
        allowUndo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input: { commentId, allowUndo }, ctx }) => {
      try {
        const userId = ctx?.user?.uid;

        if (!userId) {
          throw new Error("No userId");
        }

        if (!commentId) {
          throw new Error("No postId");
        }

        const comment = await upvoteCommentQuery({
          userId,
          commentId,
          allowUndo,
        });

        return comment;
      } catch (error) {
        throw error;
      }
    }),
});

export type AppRouter = typeof appRouter;
