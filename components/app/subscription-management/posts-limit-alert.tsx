"use client";

import { useActivityFeedbackPostsCount } from "@/hooks/use-active-feedback-posts-count";
import { useSubscription } from "@/hooks/use-subscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SubscriptionUpgradeButton } from "./upgrade-button";
import { useAuth } from "@/hooks/use-auth";

export function SubscriptionPostsLimitAlert() {
  const { isAdmin } = useAuth();

  const {
    query: { data: activityFeedbackPostsCount },
  } = useActivityFeedbackPostsCount();

  const {
    query: { data: subscription },
  } = useSubscription();

  if (
    isAdmin &&
    subscription?.name === "free" &&
    Number(activityFeedbackPostsCount) > 75
  ) {
    return (
      <Alert
        variant="default"
        className="flex items-center justify-between gap-4"
      >
        <div className="flex items-start gap-2.5">
          <div>
            <AlertTitle>Continue with Feedbackland Pro or Max</AlertTitle>
            <AlertDescription>
              New feedback can't be submitted right now because the Free plan's
              post limit is reached. Please upgrade to the Pro plan for higher
              limits, or the Max plan for unlimited posts.
            </AlertDescription>
          </div>
        </div>
        <SubscriptionUpgradeButton />
      </Alert>
    );
  }
}
