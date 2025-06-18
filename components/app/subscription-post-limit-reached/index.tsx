"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubscriptionButton } from "../subscription-button";
import { useAuth } from "@/hooks/use-auth";
import { useLimits } from "@/hooks/useLimits";
import { capitalizeFirstLetter, cn } from "@/lib/utils";

export function SubscriptionPostLimitReached({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { isAdmin, isLoaded } = useAuth();
  const { hasReachedPostLimit, subName, isPending } = useLimits();

  if (isLoaded && !isPending) {
    if (!isAdmin && hasReachedPostLimit) {
      return (
        <Alert className={cn("", className)}>
          <AlertTitle>Feedback disabled</AlertTitle>
          <AlertDescription>
            New feedback can't be submitted right now because the platform's
            usage limit is reached
          </AlertDescription>
        </Alert>
      );
    }

    if (isAdmin && hasReachedPostLimit) {
      return (
        <Alert
          variant="destructive"
          className={cn(
            "bg-destructive/5 flex items-center justify-between gap-4",
            className,
          )}
        >
          <AlertDescription className="font-medium">
            You've reached Feedbackland{" "}
            {capitalizeFirstLetter(subName || "free")}'s usage limit. Upgrade
            your plan to keep receiving feedback.
          </AlertDescription>
          <SubscriptionButton size="sm" buttonText="Upgrade" />
        </Alert>
      );
    }
  }
}
