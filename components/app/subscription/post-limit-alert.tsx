"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionManageUpgradeButton } from "./manage-upgrade-button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useIsPostLimitReached } from "@/hooks/use-is-post-limit-reached";

export function SubscriptionPostLimitAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { isAdmin, isLoaded } = useAuth();

  const {
    query: { data: isPostLimitReached },
  } = useIsPostLimitReached();

  if (isLoaded && isPostLimitReached) {
    return (
      <Alert
        variant="destructive"
        className={cn("flex items-center justify-between gap-5", className)}
      >
        <AlertDescription className="font-medium">
          {isAdmin
            ? `Feedback submissions are currently paused because you've hit your current plan's
            active posts limit. Please upgrade to continue collecting feedback.`
            : `Feedback submissions are currently paused. Please
            check again later.`}
        </AlertDescription>
        {isAdmin && (
          <SubscriptionManageUpgradeButton size="sm" buttonText="Upgrade" />
        )}
      </Alert>
    );
  }
}
