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
  status: FeedbackStatus | null;
  type: string;
  upvotes: string;
  createdAt: Date;
  id: string;
  orgId: string;
  content: string;
  postId: string;
  category: FeedbackCategory | null;
  title: string;
  commentCount: string | null;
  commentId: any;
};
