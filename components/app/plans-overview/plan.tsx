"use client";

import { Badge } from "@/components/ui/badge";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionButton } from "@/components/app/subscription-button";

export function Plan({ planName }: { planName: "free" | "pro" }) {
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
    const isCurrentPlan = planName === subscriptionName;
    const features = isFreePlan
      ? [
          "Unlimited end-users",
          "Unlimited feedback posts",
          "Unlimited admins",
          "Unlimited comments",
          "In-app feedback widget",
          "Standalone website",
        ]
      : [
          "AI Insights",
          "Ask AI",
          "Automatic content moderation",
          "Custom branding",
          "Email notifications",
          "Image uploads",
          "Anonymous feedback",
        ];

    return (
      <div className="border-border flex w-full max-w-full flex-col items-stretch space-y-4 rounded-lg border p-4 shadow-sm">
        <div className="mb-4 flex flex-col items-stretch gap-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="mb-0.5 flex items-center gap-3">
                <h3 className="h5 capitalize">{planName}</h3>

                {isCurrentPlan && (
                  <Badge variant="outline">Your current plan</Badge>
                )}

                {!isFreePlan && isCurrentPlan && isExpired && (
                  <Badge variant="destructive">
                    <TriangleAlertIcon />
                    Expired
                  </Badge>
                )}
              </div>

              {!isFreePlan && (
                <>
                  {isCurrentPlan ? (
                    <span className="flex flex-wrap items-end text-sm">
                      <span className="-mb-0.5 text-2xl">${amount}</span>/
                      {frequency} - billed{" "}
                      {frequency === "month" ? "monthly" : "yearly"}
                    </span>
                  ) : (
                    <>
                      {isProPlan && (
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
                  variant={isCurrentPlan ? "outline" : "default"}
                  buttonText={isCurrentPlan ? "Manage" : "Upgrade"}
                  subscriptionName={planName}
                  size="lg"
                />
              </div>
            )}
          </div>
        </div>

        <div className="text-primary flex flex-col items-stretch space-y-1.5 text-sm font-normal">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-1.5">
              <CheckIcon className="size-4!" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
