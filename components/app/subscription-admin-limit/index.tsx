"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionButton } from "../subscription-button";
import { cn } from "@/lib/utils";
import { useIsAdminLimitReached } from "@/hooks/use-is-admin-limit-reached";

export function SubscriptionAdminLimit({
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
          You've hit your current plan's admins limit. Please upgrade your plan
          to invite more admins.
        </AlertDescription>
        <SubscriptionButton size="sm" buttonText="Upgrade" />
      </Alert>
    );
  }
}
