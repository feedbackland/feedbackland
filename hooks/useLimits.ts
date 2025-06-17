import { useActiveFeedbackPostsCount } from "@/hooks/use-active-feedback-posts-count";
import { useSubscription } from "@/hooks/use-subscription";

export function useLimits() {
  const {
    query: { data: activityFeedbackPostsCount, isPending: isPending1 },
  } = useActiveFeedbackPostsCount();

  const {
    query: { data: subscription, isPending: isPending2 },
  } = useSubscription();

  const isPending = !!(isPending1 || isPending2);
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
