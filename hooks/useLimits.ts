import { useActiveFeedbackPostCount } from "@/hooks/use-active-feedback-post-count";
import { useSubscription } from "@/hooks/use-subscription";

export function useLimits() {
  const {
    query: {
      data: activeFeedbackPostCount,
      isPending: isActiveFeedbackPostCountPending,
    },
  } = useActiveFeedbackPostCount();

  const {
    query: { data: subscription, isPending: isSubscriptionPending },
  } = useSubscription();

  const isPending = !!(
    isActiveFeedbackPostCountPending || isSubscriptionPending
  );
  const subName = subscription?.name;
  const postCount = activeFeedbackPostCount || 0;
  const hasReachedFreePostLimit = subName === "free" && postCount >= 1;
  const hasReachedProPostLimit = subName === "pro" && postCount >= 1;
  const hasReachedPostLimit = hasReachedFreePostLimit || hasReachedProPostLimit;

  console.log("activeFeedbackPostCount", activeFeedbackPostCount);
  console.log("subscription", subscription);

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
