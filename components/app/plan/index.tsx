"use client";

import { Badge } from "@/components/ui/badge";
import { TriangleAlertIcon } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionManageUpgradeButton } from "@/components/app/subscription/manage-upgrade-button";

export function Plan() {
  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (!isPending && subscription) {
    const { isExpired, amount, frequency } = subscription;

    return (
      <div className="">
        <h2 className="h4 mb-6">Plan</h2>
        <div className="border-border flex w-full max-w-[350px] flex-col items-stretch space-y-4 rounded-lg border p-4 shadow-sm">
          <div className="">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold capitalize">
                  {subscription?.name || "Free"}
                </h3>
                <div className="-mt-1 -mr-1">
                  <SubscriptionManageUpgradeButton
                    variant="link"
                    className="underline"
                    buttonText="Manage & change plan"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {subscription && isExpired && (
                  <Badge variant="destructive">
                    <TriangleAlertIcon />
                    Expired
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch">
            <div className="mb-0.5 flex items-end">
              <span className="text-2xl font-semibold">${amount}</span>
              <span className="mb-1 text-sm font-normal">/{frequency}</span>
            </div>
            {subscription && (
              <div className="text-muted-foreground text-sm">
                {frequency === "month" && "Billed monthly"}
                {frequency === "year" && "Billed annually"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
