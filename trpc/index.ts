import { router } from "@/lib/trpc";
import { updateFeedbackPostStatus } from "./update-feedback-post-status";
import { upvoteComment } from "./upvote-comment";
import { getMentionableUsers } from "./get-mentionable-users";
import { getOrg } from "./get-org";
import { claimOrg } from "./claim-org";
import { createFeedbackPost } from "./create-feedback-post";
import { upvoteFeedbackPost } from "./upvote-feedback-post";
import { getFeedbackPosts } from "./get-feedback-posts";
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
import { generateInsight } from "./generate-insight";

export const appRouter = router({
  updateFeedbackPostStatus,
  upvoteComment,
  getMentionableUsers,
  getOrg,
  claimOrg,
  createFeedbackPost,
  upvoteFeedbackPost,
  getFeedbackPosts,
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
  generateInsight,
});

export type AppRouter = typeof appRouter;
