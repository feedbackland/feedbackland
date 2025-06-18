"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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

  if (isLoaded && !isPending && hasReachedPostLimit) {
    return (
      <Alert
        variant="destructive"
        className={cn(
          "bg-destructive/5 flex items-center justify-between gap-4",
          className,
        )}
      >
        <AlertDescription className="font-medium">
          {isAdmin
            ? `You've hit Feedbackland ${capitalizeFirstLetter(subName || "free")}'s
            usage limit. Upgrade your plan to continue receiving feedback.`
            : `We're sorry, but feedback submissions are currently paused. Please
            check again later.`}
        </AlertDescription>
        {isAdmin && <SubscriptionButton size="sm" buttonText="Upgrade" />}
      </Alert>
    );
  }
}
