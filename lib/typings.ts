import { z } from "zod/v4";
import {
  feedbackOrderBySchema,
  feedbackStatusSchema,
  feedbackCategorySchema,
  upsertUserSchema,
  userRoleSchema,
  feedbackPostsCursorSchema,
  feedbackCategoriesSchema,
  insightEffortSchema,
} from "./schemas";

export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export type FeedbackOrderBy = z.infer<typeof feedbackOrderBySchema>;

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export type FeedbackCategories = z.infer<typeof feedbackCategoriesSchema>;

export type UpsertUser = z.infer<typeof upsertUserSchema>;

export type UserRole = z.infer<typeof userRoleSchema>;

export type FeedbackPostsCursor = z.infer<typeof feedbackPostsCursorSchema>;

export type InsightEffort = z.infer<typeof insightEffortSchema>;

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
  authorPhotoURL?: string | null;
  isSeen?: boolean;
};

/**
 * Everything that went into an insight's priority score, kept so the score can be
 * shown as a breakdown rather than asserted as a number. `reachScore` and
 * `momentumScore` are normalised against the strongest insight in the same run;
 * `severityScore` is the model's absolute judgement.
 */
export type InsightSignals = {
  reachScore: number;
  momentumScore: number;
  severityScore: number;
  effortMultiplier: number;
  postCount: number;
  upvotes: number;
  commentCount: number;
  reach: number;
  recentPostCount: number;
  recentUpvotes: number;
  recentCommentCount: number;
  latestActivityAt: string | null;
  evidence: string;
  confidence: number;
  previous: {
    priority: number;
    reach: number;
    postCount: number;
    at: string;
  } | null;
};

/**
 * An insight as the client consumes it: numerics already parsed, and the
 * post ids under a name that says what they are.
 *
 * `status` is rolled up from the live feedback posts on every read rather than
 * stored, so it can never drift from what the board actually says.
 */
export type Insight = {
  id: string;
  title: string;
  description: string;
  postIds: string[];
  priority: number;
  reach: number;
  momentum: number;
  upvotes: number;
  commentCount: number;
  effort: InsightEffort;
  /** The status every post shares, or null when they have none or disagree. */
  status: FeedbackStatus;
  /** True when the posts carry more than one status. */
  isMixedStatus: boolean;
  category: FeedbackCategory;
  signals: InsightSignals | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isNew: boolean;
};

/** Summary of the most recent analysis run — the page's coverage strip. */
export type InsightsRun = {
  createdAt: Date;
  postsTotal: number;
  postsAnalyzed: number;
  postsClustered: number;
  insightCount: number;
  newInsightCount: number;
  archivedInsightCount: number;
  model: string | null;
};

export type Insights = {
  insights: Insight[];
  run: InsightsRun | null;
  /** Open posts available to analyse right now, for the empty and first-run states. */
  openPostCount: number;
};

export type IframeParentAPI = {
  close: () => void;
};
