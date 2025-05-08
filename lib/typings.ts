import { z } from "zod";
import {
  feedbackOrderBySchema,
  feedbackStatusSchema,
  feedbackCategorySchema,
  upsertUserSchema,
  userRoleSchema,
  upsertOrgSchema,
  feedbackPostsCursorSchema,
  feedbackCategoriesSchema,
  insightsCursorSchema,
} from "./schemas";

export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export type FeedbackOrderBy = z.infer<typeof feedbackOrderBySchema>;

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export type FeedbackCategories = z.infer<typeof feedbackCategoriesSchema>;

export type UpsertUser = z.infer<typeof upsertUserSchema>;

export type UpsertOrg = z.infer<typeof upsertOrgSchema>;

export type UserRole = z.infer<typeof userRoleSchema>;

export type FeedbackPostsCursor = z.infer<typeof feedbackPostsCursorSchema>;

export type InsightsCursor = z.infer<typeof insightsCursorSchema>;

export type ActivityFeedItem = {
  orgId: string;
  id: string;
  postId: string;
  commentId: string | null;
  createdAt: Date;
  title: string | null;
  content: string;
  upvotes: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  type: string;
  commentCount: string | null;
  authorId: string | null;
  authorName?: string | null;
  postTitle?: string | null;
  isSeen?: boolean;
};
