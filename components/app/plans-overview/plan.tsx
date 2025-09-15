"use client";

import { Badge } from "@/components/ui/badge";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionButton } from "@/components/app/subscription-button";
import { adminLimit, analyzablePostLimit, roadmapLimit } from "@/lib/utils";

export function Plan({ planName }: { planName: "free" | "pro" | "max" }) {
  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (!isPending && subscription) {
    const {
      isExpired,
      amount,
      frequency,
      name: subscriptionName,
    } = subscription;
    const isFreePlan = planName === "free";
    const isProPlan = planName === "pro";
    const isMaxPlan = planName === "max";
    const isActiveSubscription = planName === subscriptionName;
    const postsLimit =
      planName === "max"
        ? "Unlimited"
        : analyzablePostLimit(planName).toLocaleString("en", {
            useGrouping: true,
          });
    const roadmapsLimit =
      planName === "max" ? "Unlimited" : roadmapLimit(planName);
    const adminsLimit = planName === "max" ? "Unlimited" : adminLimit(planName);

    return (
      <div className="border-border flex w-full max-w-full flex-col items-stretch space-y-4 rounded-lg border p-4 shadow-sm">
        <div className="mb-4 flex flex-col items-stretch gap-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="mb-0.5 flex items-center gap-3">
                <h3 className="h5 capitalize">{planName}</h3>

                {isActiveSubscription && (
                  <Badge variant="outline">Your current plan</Badge>
                )}

                {isActiveSubscription && !isFreePlan && isExpired && (
                  <Badge variant="destructive">
                    <TriangleAlertIcon />
                    Expired
                  </Badge>
                )}
              </div>

              {!isFreePlan && (
                <>
                  {isActiveSubscription ? (
                    <span className="flex flex-wrap items-end text-sm">
                      <span className="-mb-0.5 text-2xl">${amount}</span>/
                      {frequency} - billed{" "}
                      {frequency === "month" ? "monthly" : "yearly"}
                    </span>
                  ) : (
                    <>
                      {isProPlan && (
                        <span className="flex flex-wrap items-end text-sm">
                          <span className="-mb-0.5 text-2xl">$9</span>/month or
                          $90/year
                        </span>
                      )}
                      {isMaxPlan && (
                        <span className="flex flex-wrap items-end text-sm">
                          <span className="-mb-0.5 text-2xl">$29</span>/month or
                          $290/year
                        </span>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {!isFreePlan && (
              <div className="mt-1 mr-1">
                <SubscriptionButton
                  variant={isActiveSubscription ? "outline" : "default"}
                  buttonText={isActiveSubscription ? "Manage" : "Upgrade"}
                  subscriptionName={planName}
                  size="lg"
                />
              </div>
            )}
          </div>
        </div>

        <div className="text-primary flex flex-col items-stretch space-y-1.5 text-sm font-normal">
          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>{adminsLimit} admins</span>
          </div>

          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>{roadmapsLimit} AI roadmaps/month</span>
          </div>

          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>
              {postsLimit} feedback posts analyzed per generated AI roadmap
            </span>
          </div>

          {isMaxPlan && (
            <>
              <div className="flex items-center gap-1.5">
                <CheckIcon className="size-4!" />
                <span>Automatic content moderation</span>
              </div>
              {/* <div className="flex items-center gap-1.5">
                <CheckIcon className="size-4!" />
                <span>No Feedbackland branding</span>
              </div> */}
            </>
          )}
        </div>
      </div>
    );
  }
}
