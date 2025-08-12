"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { Plan } from "./plan";

export function PlansOverview() {
  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (!isPending && subscription) {
    const { name } = subscription;
    const isFreePlan = name === "free";
    const isProPlan = name === "pro";
    const isMaxPlan = name === "max";

    // return (
    //   <div className="flex flex-nowrap gap-2">
    //     <Plan planName="free" />
    //     <Plan planName="pro" />
    //     <Plan planName="max" />
    //   </div>
    // );

    return (
      <div className="">
        <h3 className="mb-3 text-sm font-medium">Your current plan</h3>
        <Plan planName={name as "free" | "pro" | "max"} />

        {!isMaxPlan && (
          <>
            <h3 className="mt-12 mb-3 text-sm font-medium">Upgrade to</h3>
            {isFreePlan && (
              <div className="space-y-4">
                <Plan planName="pro" />
                <Plan planName="max" />
              </div>
            )}
            {isProPlan && (
              <div className="space-y-4">
                <Plan planName="max" />
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}
