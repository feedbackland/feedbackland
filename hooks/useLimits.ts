import { useActiveFeedbackPostsCount } from "@/hooks/use-active-feedback-posts-count";
import { useSubscription } from "@/hooks/use-subscription";

export function useLimits() {
  const {
    query: { data: activityFeedbackPostsCount, isPending: isPostCountPending },
  } = useActiveFeedbackPostsCount();

  const {
    query: { data: subscription, isPending: isSubscriptionPending },
  } = useSubscription();

  const isPending = !!(isPostCountPending || isSubscriptionPending);
  const subName = subscription?.name;
  const postCount = activityFeedbackPostsCount || 0;
  const hasReachedFreePostLimit = subName === "free" && postCount >= 1;
  const hasReachedProPostLimit = subName === "pro" && postCount >= 1;
  const hasReachedPostLimit = hasReachedFreePostLimit || hasReachedProPostLimit;

  return {
    isPending,
    subName,
    hasFreePlan: subName === "free",
    hasProPlan: subName === "pro",
    hasReachedPostLimit,
    hasReachedFreePostLimit,
    hasReachedProPostLimit,
  };
}
