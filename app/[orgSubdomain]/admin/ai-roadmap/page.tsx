"use client";

import { Insights } from "@/components/app/insights";
import { UpgradeAlert } from "@/components/ui/upgrade-alert";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";

export default function AIRoadmapPage() {
  const { isAdmin } = useAuth();

  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  const { name, isExpired } = subscription || {};

  const hasAccess = !!(name === "pro" && !isExpired);

  if (isAdmin && subscription && !isPending) {
    if (!hasAccess) {
      return (
        <UpgradeAlert
          title={
            isExpired
              ? "Your subscription is expired"
              : "Your current plan does not have access to 'AI Roadmap'"
          }
          description={
            isExpired
              ? "Update your subscription to access AI Roadmaps."
              : "Upgrade your subscription to access AI Roadmaps."
          }
          buttonText={isExpired ? "Update subscription" : "Upgrade"}
        />
      );
    }

    return <Insights />;
  }
}
