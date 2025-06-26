"use client";

import { useRoadmapUsage } from "@/hooks/use-roadmap-usage";
import { UsageAlert } from "@/components/ui/usage-alert";

export function RoadmapUsageAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: roadmapUsage },
  } = useRoadmapUsage();

  if (roadmapUsage?.left === 1) {
    return (
      <UsageAlert
        className={className}
        title="You've almost reached your roadmap limit"
        description={`You can generate 1 more roadmap this month. Upgrade your plan to increase limits.`}
      />
    );
  }

  if (roadmapUsage?.limitReached && roadmapUsage?.limit) {
    return (
      <UsageAlert
        className={className}
        title="Roadmap limit reached"
        description={`You've reached your plan's limit of ${roadmapUsage?.limit} roadmaps/month. To keep on generating roadmaps, please upgrade your plan.`}
      />
    );
  }
}
