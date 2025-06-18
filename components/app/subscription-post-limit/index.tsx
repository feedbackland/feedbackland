"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionButton } from "../subscription-button";
import { useAuth } from "@/hooks/use-auth";
import { useLimits } from "@/hooks/useLimits";
import { capitalizeFirstLetter, cn } from "@/lib/utils";

export function SubscriptionPostLimit({
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
        className={cn("flex items-center justify-between gap-5", className)}
      >
        <AlertDescription className="font-medium">
          {isAdmin
            ? `Feedback submissions are currently paused because you've hit Feedbackland ${capitalizeFirstLetter(subName || "free")}'s
            posts limit. Please upgrade your plan to continue collecting feedback.`
            : `Feedback submissions are currently paused. Please
            check again later.`}
        </AlertDescription>
        {isAdmin && <SubscriptionButton size="sm" buttonText="Upgrade" />}
      </Alert>
    );
  }
}
