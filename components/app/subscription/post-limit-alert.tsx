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
        className={cn(
          "border-destructive bg-destructive/5 flex items-center justify-between gap-5 border",
          className,
        )}
      >
        <AlertDescription className="font-medium">
          {isAdmin
            ? `You've hit your current plan's active posts limit. Please upgrade to continue collecting feedback.`
            : `Feedback submission is currently disabled. Please check again later.`}
        </AlertDescription>
        {isAdmin && (
          <SubscriptionManageUpgradeButton size="sm" buttonText="Upgrade" />
        )}
      </Alert>
    );
  }
}
