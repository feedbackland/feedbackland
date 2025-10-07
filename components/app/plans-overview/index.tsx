"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { Plan } from "./plan";

export function PlansOverview() {
  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (!isPending && subscription) {
    const { name, isTrial } = subscription;
    const currentPlan = name;

    return (
      <div className="flex flex-col gap-8 sm:flex-row">
        {(currentPlan === "free" || isTrial) && (
          <>
            <Plan planName="free" />
            <Plan planName="pro" />
          </>
        )}

        {currentPlan === "pro" && !isTrial && <Plan planName="pro" />}
      </div>
    );
  }
}
