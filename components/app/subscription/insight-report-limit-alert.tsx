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

  if (isInsightReportLimitReached?.exhausted === true) {
    return (
      <Alert
        variant="destructive"
        className={cn(
          "border-destructive bg-destructive/5 flex items-center justify-between gap-5 border",
          className,
        )}
      >
        <AlertDescription className="font-medium">
          You've reached your plan's limit of{" "}
          {isInsightReportLimitReached.roadmapsLimit} roadmaps/month. To create
          more, you can upgrade your plan in just a few clicks.
        </AlertDescription>
        <SubscriptionManageUpgradeButton size="sm" buttonText="Upgrade" />
      </Alert>
    );
  }
}
