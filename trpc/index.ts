import { router } from "@/lib/trpc";
import { updateFeedbackPostStatus } from "./update-feedback-post-status";
import { upvoteComment } from "./upvote-comment";
import { getMentionableUsers } from "./get-mentionable-users";
import { getOrg } from "./get-org";
import { claimOrg } from "./claim-org";
import { createFeedbackPost } from "./create-feedback-post";
import { upvoteFeedbackPost } from "./upvote-feedback-post";
import { getFeedbackPosts } from "./get-feedback-posts";
import { getFeedbackPostsByIds } from "./get-feedback-posts-by-ids";
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
import { generateInsights } from "./generate-insights";
import { getInsights, getAllInsights } from "./get-insights";
import { updateOrg } from "./update-org";
import { createAdminInvite } from "./create-admin-invite";
import { getAdmins } from "./get-admins";
import { deleteAdminInvite } from "./delete-admin-invite";
import { redeemAdminInvite } from "./redeem-admin-invite";
import { deleteAdmin } from "./delete-admin";
import { getAdminInvite } from "./get-admin-invite";
import { setAllActivitiesSeen } from "./set-all-activities-seen";
import { createPolarCustomerSession } from "./create-polar-customer-session";
import { createPolarCheckoutSession } from "./create-polar-checkout-session";
import { getPolarProducts } from "./get-polar-products";
import { getSubscription } from "./get-subscription";
import { getPolarProduct } from "./get-polar-product";
import { getIsAdminLimitReached } from "./get-is-admin-limit-reached";
import { getIsPostLimitReached } from "./get-is-post-limit-reached";
import { getIsInsightReportLimitReached } from "./get-is-insight-report-limit-reached";
import { updateUser } from "./update-user";

export const appRouter = router({
  updateFeedbackPostStatus,
  upvoteComment,
  getMentionableUsers,
  getOrg,
  claimOrg,
  createFeedbackPost,
  upvoteFeedbackPost,
  getFeedbackPosts,
  getFeedbackPostsByIds,
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
  generateInsights,
  getInsights,
  getAllInsights,
  updateOrg,
  createAdminInvite,
  deleteAdminInvite,
  getAdmins,
  redeemAdminInvite,
  getAdminInvite,
  deleteAdmin,
  createPolarCustomerSession,
  createPolarCheckoutSession,
  getPolarProducts,
  getPolarProduct,
  getSubscription,
  getIsAdminLimitReached,
  getIsPostLimitReached,
  getIsInsightReportLimitReached,
  updateUser,
});

export type AppRouter = typeof appRouter;
