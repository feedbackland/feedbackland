import { z } from "zod/v4";
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

export type Admin = {
  userId: string | null;
  adminInviteId: string | null;
  createdAt: Date;
  email: string;
  name: string | null;
  status: "admin" | "invited";
};

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
  isSeen?: boolean;
};

// Define a type for insights data as it's received from the query (unwrapped Kysely types)
export type InsightData = {
  id: string;
  orgId: string;
  title: string;
  description: string;
  category: FeedbackCategory | null;
  status: FeedbackStatus | null;
  upvotes: string; // Numeric from DB often comes as string
  commentCount: string; // Numeric from DB often comes as string
  priority: string; // Numeric from DB often comes as string
  ids: string[];
  createdAt: Date; // Timestamp from DB often comes as Date object
};

export type IframeParentAPI = {
  close: () => void;
};
