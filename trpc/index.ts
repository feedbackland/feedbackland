import { getSearchIndex, rebuildSearchIndex } from "./search-index";
import { getSettings } from "./get-settings";
import { updateSettings } from "./update-settings";
import { router } from "@/lib/trpc";
import { updateFeedbackPostStatus } from "./update-feedback-post-status";
import { upvoteComment } from "./upvote-comment";
import { getMentionableUsers } from "./get-mentionable-users";
import { createFeedbackPost } from "./create-feedback-post";
import { upvoteFeedbackPost } from "./upvote-feedback-post";
import { getFeedbackPosts } from "./get-feedback-posts";
import { getFeedbackPostsByIds } from "./get-feedback-posts-by-ids";
import { getFeedbackPostCount } from "./get-feedback-post-count";
import { getFeedbackPost } from "./get-feedback-post";
import { createComment } from "./create-comment";
import { getComment } from "./get-comment";
import { getComments } from "./get-comments";
import { deleteFeedbackPost } from "./delete-feedback-post";
import { updateFeedbackPost } from "./update-feedback-post";
import { updateComment } from "./update-comment";
import { deleteComment } from "./delete-comment";
import { getActivityFeed } from "./get-activity-feed";
import { setActivitiesSeen } from "./set-activities-seen";
import { getActivityFeedMetaData } from "./get-activity-feed-meta-data";
import { startInsightsRun } from "./start-insights-run";
import { getInsightsRun } from "./get-insights-run";
import { getInsights } from "./get-insights";
import { getInsightEvidence } from "./get-insight-evidence";
import { setInsightStatus } from "./set-insight-status";
import { createAdminInvite } from "./create-admin-invite";
import { getAdmins } from "./get-admins";
import { deleteAdminInvite } from "./delete-admin-invite";
import { redeemAdminInvite } from "./redeem-admin-invite";
import { deleteAdmin } from "./delete-admin";
import { getAdminInvite } from "./get-admin-invite";
import { setAllActivitiesSeen } from "./set-all-activities-seen";
import { updateUser } from "./update-user";
import { getUserSession } from "./get-user-session";
import { getModerationCoverage } from "./get-moderation-coverage";
import { rewriteFeedback } from "./rewrite-feedback";
import { createPasswordResetLink } from "./create-password-reset-link";
import { retryOidcDiscovery } from "./retry-oidc-discovery";
import { getAuthStatus } from "./get-auth-status";

import { getImageUsage, reclaimPendingImages } from "./reclaim-pending-images";
import { issueSearchTicket } from "./issue-search-capability";
export const appRouter = router({
  issueSearchTicket,
  getSearchIndex,
  rebuildSearchIndex,
  getImageUsage,
  reclaimPendingImages,
  updateSettings,
  getSettings,
  updateFeedbackPostStatus,
  upvoteComment,
  getMentionableUsers,
  createFeedbackPost,
  upvoteFeedbackPost,
  getFeedbackPosts,
  getFeedbackPostsByIds,
  getFeedbackPostCount,
  getFeedbackPost,
  createComment,
  getComment,
  getComments,
  deleteFeedbackPost,
  updateFeedbackPost,
  updateComment,
  deleteComment,
  getActivityFeed,
  getActivityFeedMetaData,
  setActivitiesSeen,
  setAllActivitiesSeen,
  startInsightsRun,
  getInsightsRun,
  getInsights,
  setInsightStatus,
  getInsightEvidence,
  createAdminInvite,
  deleteAdminInvite,
  getAdmins,
  redeemAdminInvite,
  getAdminInvite,
  deleteAdmin,
  updateUser,
  getUserSession,
  rewriteFeedback,
  getModerationCoverage,
  createPasswordResetLink,
  retryOidcDiscovery,
  getAuthStatus,
});

export type AppRouter = typeof appRouter;
