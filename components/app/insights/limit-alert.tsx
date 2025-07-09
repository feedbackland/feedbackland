"use client";

import { useRoadmapLimit } from "@/hooks/use-roadmap-limit";
import { PlanLimitAlert } from "@/components/ui/plan-limit-alert";
import { useAnalyzablePostLimit } from "@/hooks/use-analyzable-post-limit";
import { useSubscription } from "@/hooks/use-subscription";

export function InsightsLimitAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: subscription, isPending: isSubscriptionPending },
  } = useSubscription();

  const {
    query: { data: roadmapLimit, isPending: isRoadmapLimitPending },
  } = useRoadmapLimit();

  const {
    query: {
      data: analyzablePostLimit,
      isPending: isAnalyzablePostLimitPending,
    },
  } = useAnalyzablePostLimit();

  const isPending = !!(
    isRoadmapLimitPending ||
    isAnalyzablePostLimitPending ||
    isSubscriptionPending
  );

  if (isPending) return null;

  if (subscription?.activeSubscription !== "max") {
    if (roadmapLimit?.limitReached) {
      return (
        <PlanLimitAlert
          className={className}
          type="alert"
          title="Your plan's monthly roadmap limit is reached"
          description={`You've reached your current plan's limit of ${roadmapLimit?.limit} monthly roadmaps. To increase your limit, please upgrade your plan.`}
        />
      );
    }

    if (analyzablePostLimit?.limitReached) {
      return (
        <PlanLimitAlert
          className={className}
          type="warning"
          title="Your plan's analyzable feedback posts limit is reached"
          description={`You've reached your current plan's limit of ${analyzablePostLimit?.limit} analyzable feedback posts. To increase your limit, please upgrade your plan.`}
        />
      );
    }
  }

  return null;
}
