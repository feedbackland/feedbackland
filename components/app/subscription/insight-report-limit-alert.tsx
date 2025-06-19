"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionManageUpgradeButton } from "./manage-upgrade-button";
import { cn } from "@/lib/utils";
import { useIsInsightReportLimitReached } from "@/hooks/use-is-insight-report-limit-reached";

export function SubscriptionInsightReportLimitAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: isInsightReportLimitReached },
  } = useIsInsightReportLimitReached();

  if (isInsightReportLimitReached) {
    return (
      <Alert
        variant="destructive"
        className={cn("flex items-center justify-between gap-5", className)}
      >
        <AlertDescription className="font-medium">
          You've hit your current plan's roadmap limit. Please upgrade to
          generate more roadmaps.
        </AlertDescription>
        <SubscriptionManageUpgradeButton size="sm" buttonText="Upgrade" />
      </Alert>
    );
  }
}
