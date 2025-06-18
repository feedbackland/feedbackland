import { useActiveFeedbackPostCount } from "@/hooks/use-active-feedback-post-count";
import { useSubscription } from "@/hooks/use-subscription";
import { useAdminCount } from "@/hooks/use-admin-count";

export function useLimits() {
  const {
    query: { data: adminCount, isPending: isAdminCountPending },
  } = useAdminCount();

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
    isActiveFeedbackPostCountPending ||
    isSubscriptionPending ||
    isAdminCountPending
  );

  const subName = subscription?.name;
  const hasFreePlan = subName === "free";
  const hasProPlan = subName === "pro";

  const postCount = activeFeedbackPostCount || 0;

  const hasReachedFreePostLimit = hasFreePlan && postCount >= 1;
  const hasReachedProPostLimit = hasProPlan && postCount >= 1;
  const hasReachedPostLimit = hasReachedFreePostLimit || hasReachedProPostLimit;

  const hasReachedFreeAdminLimit =
    !isAdminCountPending && hasFreePlan && adminCount && adminCount >= 1;
  const hasReachedProAdminLimit =
    !isAdminCountPending && hasProPlan && adminCount && adminCount >= 1;
  const hasReachedAdminLimit =
    hasReachedFreeAdminLimit || hasReachedProAdminLimit;

  return {
    isPending,
    subName,
    hasFreePlan,
    hasProPlan,
    hasReachedPostLimit,
    hasReachedFreePostLimit,
    hasReachedProPostLimit,
    hasReachedAdminLimit,
    hasReachedFreeAdminLimit,
    hasReachedProAdminLimit,
  };
}
