import { z } from "zod";
import {
  feedbackOrderBySchema,
  feedbackStatusSchema,
  feedbackCategorySchema,
  upsertUserSchema,
  userRoleSchema,
  upsertOrgSchema,
  feedbackPostsCursorSchema,
} from "./schemas";

export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export type FeedbackOrderBy = z.infer<typeof feedbackOrderBySchema>;

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export type UpsertUser = z.infer<typeof upsertUserSchema>;

export type UpsertOrg = z.infer<typeof upsertOrgSchema>;

export type UserRole = z.infer<typeof userRoleSchema>;

export type FeedbackPostsCursor = z.infer<typeof feedbackPostsCursorSchema>;

export type ActivityFeedItem = {
  orgId: string;
  id: string;
  postId: string;
  commentId: string | null;
  createdAt: Date;
  title: string | null; // Should be nullable as it's null for comments
  content: string;
  upvotes: string;
  category: FeedbackCategory | null;
  status: FeedbackStatus | null;
  type: string;
  commentCount: string | null;
  authorId: string | null;
  authorName?: string | null; // Optional as it's null for posts
  postTitle?: string | null; // Optional as it's null for comments (or redundant for posts)
  isSeen?: boolean; // Add the new seen status flag
};
