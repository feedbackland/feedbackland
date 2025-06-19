"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionManageUpgradeButton } from "./manage-upgrade-button";
import { cn } from "@/lib/utils";
import { useIsAdminLimitReached } from "@/hooks/use-is-admin-limit-reached";

export function SubscriptionAdminLimitAlert({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data: isAdminLimitReached },
  } = useIsAdminLimitReached();

  if (isAdminLimitReached) {
    return (
      <Alert
        variant="destructive"
        className={cn("flex items-center justify-between gap-5", className)}
      >
        <AlertDescription className="font-medium">
          You've hit your current plan's admins limit. Please upgrade to invite
          more admins.
        </AlertDescription>
        <SubscriptionManageUpgradeButton size="sm" buttonText="Upgrade" />
      </Alert>
    );
  }
}
