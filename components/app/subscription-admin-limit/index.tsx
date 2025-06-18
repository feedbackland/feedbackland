"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionButton } from "../subscription-button";
import { useLimits } from "@/hooks/useLimits";
import { capitalizeFirstLetter, cn } from "@/lib/utils";

export function SubscriptionAdminLimit({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { hasReachedAdminLimit, subName, isPending } = useLimits();

  if (!isPending && hasReachedAdminLimit) {
    return (
      <Alert
        variant="destructive"
        className={cn("flex items-center justify-between gap-5", className)}
      >
        <AlertDescription className="font-medium">
          You've hit Feedbackland {capitalizeFirstLetter(subName || "free")}'s
          admins limit. Please upgrade your plan to invite more admins.
        </AlertDescription>
        <SubscriptionButton size="sm" buttonText="Upgrade" />
      </Alert>
    );
  }
}
