"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { Plan } from "./plan";

export function PlansOverview() {
  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (!isPending && subscription) {
    const { name } = subscription;
    const isProPlan = name === "pro";

    return (
      <div className="">
        <h3 className="text-muted-foreground mb-3 text-sm font-medium">
          Your current plan
        </h3>

        <Plan planName={name as "free" | "pro"} />

        {!isProPlan && (
          <>
            <h3 className="text-muted-foreground mt-12 mb-3 text-sm font-medium">
              Upgrade to
            </h3>
            <div className="space-y-4">
              <Plan planName="pro" />
            </div>
          </>
        )}
      </div>
    );
  }
}
