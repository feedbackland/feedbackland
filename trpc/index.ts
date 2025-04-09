import { router } from "@/lib/trpc";
import { searchFeedbackPosts } from "./search-feedback-posts";
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

export const appRouter = router({
  searchFeedbackPosts,
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
});

export type AppRouter = typeof appRouter;
