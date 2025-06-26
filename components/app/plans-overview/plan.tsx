"use client";

import { Badge } from "@/components/ui/badge";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionManageUpgradeButton } from "@/components/app/subscription/manage-upgrade-button";

const getActivePostCount = (planName: "free" | "pro" | "max") => {
  if (planName === "free") return 75;
  if (planName === "pro") return 500;
  return null;
};

const getAdminCount = (planName: "free" | "pro" | "max") => {
  if (planName === "free") return 2;
  if (planName === "pro") return 5;
  return null;
};

const getRoadmapCount = (planName: "free" | "pro" | "max") => {
  if (planName === "free") return 3;
  if (planName === "pro") return 20;
  return null;
};

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

    return (
      <div className="border-border flex w-full max-w-full flex-col items-stretch space-y-4 rounded-lg border p-4 shadow-sm">
        <div className="mb-4 flex flex-col items-stretch gap-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="mb-0.5 flex items-center gap-2">
                <h3 className="text-lg font-bold capitalize">{planName}</h3>
                {isActiveSubscription && (
                  <Badge variant="default">Current plan</Badge>
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
                      {frequency}, billed{" "}
                      {frequency === "month" ? "monthly" : "yearly"}
                    </span>
                  ) : (
                    <>
                      {isProPlan && (
                        <span className="flex flex-wrap items-end text-sm">
                          <span className="-mb-0.5 text-2xl">$19</span>/month or
                          $190/year
                        </span>
                      )}
                      {isMaxPlan && (
                        <span className="flex flex-wrap items-end text-sm">
                          <span className="-mb-0.5 text-2xl">$39</span>/month or
                          $390/year
                        </span>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {!isFreePlan && (
              <div className="mt-1 mr-1">
                <SubscriptionManageUpgradeButton
                  variant={isActiveSubscription ? "outline" : "default"}
                  buttonText={isActiveSubscription ? "Manage" : "Upgrade"}
                  size="lg"
                />
              </div>
            )}
          </div>
        </div>

        <div className="text-muted-foreground flex flex-col items-stretch space-y-1 text-sm font-medium">
          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>
              {getActivePostCount(planName) || "Unlimited"} Active Posts
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>{getAdminCount(planName) || "Unlimited"} Admins</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>
              {getRoadmapCount(planName) || "Unlimited"} AI Roadmaps/Month
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckIcon className="size-4!" />
            <span>{isFreePlan ? "Feedbackland Branding" : "No Branding"}</span>
          </div>
        </div>
      </div>
    );
  }
}
