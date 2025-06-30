"use client";

import { useRoadmapLimit } from "@/hooks/use-roadmap-limit";
import { PlanLimitAlert } from "@/components/ui/plan-limit-alert";
import { useAnalyzablePostLimit } from "@/hooks/use-analyzable-post-limit";

export function RoadmapLimitAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: roadmapLimit, isPending: isRoadmapLimitPending },
  } = useRoadmapLimit();

  const {
    query: {
      data: analyzablePostLimit,
      isPending: isAnalyzablePostLimitPending,
    },
  } = useAnalyzablePostLimit();

  const isPending = !!(isRoadmapLimitPending || isAnalyzablePostLimitPending);

  let type: "alert" | "warning" | undefined = undefined;
  let title: string | undefined = undefined;
  let description: string | undefined = undefined;

  if (isPending) return null;

  if (roadmapLimit?.limitReached) {
    type = "alert";
    title = "Roadmap limit reached";
    description = `You've reached your plan's limit of ${roadmapLimit?.limit} roadmaps/month. Upgrade your plan to increase your limit.`;
  } else if (!analyzablePostLimit?.limitReached) {
    type = "warning";
    title = "Feedback Analysis Limit Reached";
    description = `You've reached your plan's limit of ${analyzablePostLimit?.limit} analyzable feedback posts. As a result, not all feedback can be included in the roadmap analysis. Upgrade your plan to increase your limit.`;
  }

  if (title && description) {
    return (
      <PlanLimitAlert
        className={className}
        type={type}
        title={title}
        description={description}
      />
    );
  }
}
