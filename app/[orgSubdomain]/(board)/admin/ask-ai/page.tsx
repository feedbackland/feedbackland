"use client";

import AskAI from "@/components/app/ask-ai";
import { useOrg } from "@/hooks/use-org";
import { UpgradeAlert } from "@/components/ui/upgrade-alert";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";

export default function AskAIPage() {
  const { isAdmin } = useAuth();

  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  const {
    query: { data: org },
  } = useOrg();

  const { name, isExpired } = subscription || {};

  const hasAccess = !!(name === "pro" && !isExpired);

  if (isAdmin && subscription && !isPending) {
    if (!hasAccess) {
      return (
        <UpgradeAlert
          title={
            isExpired
              ? "Your subscription is expired"
              : "Your current plan does not have access to 'Ask AI'"
          }
          description={
            isExpired
              ? "Update your subscription to access Ask AI."
              : "Upgrade your subscription to access Ask AI."
          }
          buttonText={isExpired ? "Update subscription" : "Upgrade"}
        />
      );
    }

    if (org && org.id) {
      return <AskAI orgId={org.id} />;
    }
  }
}
