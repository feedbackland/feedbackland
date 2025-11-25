"use client";

import { Badge } from "@/components/ui/badge";
import {
  CheckIcon,
  InfoIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionButton } from "@/components/app/subscription-button";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";

const getTrialDaysLeft = (trialEnd: string) => {
  const daysLeft = differenceInDays(parseISO(trialEnd), new Date());
  return `Trial ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
};

export function Plan({ planName }: { planName: "free" | "pro" }) {
  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (!isPending && subscription) {
    const {
      isExpired,
      isTrial,
      trialEnd,
      name: subscriptionName,
    } = subscription;
    const isFreePlan = planName === "free";
    const isProPlan = planName === "pro";
    const isCurrentPlan = planName === subscriptionName;
    const features = isFreePlan
      ? [
          "Unlimited end-users",
          "Unlimited admins",
          "Unlimited feedback posts",
          "Unlimited comments",
          "Anonymous feedback",
          "In-app feedback widgets",
          "Standalone website",
        ]
      : [
          "Everything from Cloud Free",
          "AI Roadmap",
          "Ask AI",
          "Automatic content moderation",
          "Image uploads",
          "Email notifications",
          "Slack & Linear integrations",
        ];

    return (
      <div
        className={cn(
          "border-border bg-background relative flex w-full max-w-full flex-1 flex-col items-stretch rounded-lg border p-5 shadow-xs",
          {
            "border-primary": isProPlan,
            "border-2": isProPlan,
          },
        )}
      >
        <div className="flex flex-col items-stretch space-y-5">
          <div className="flex flex-col items-stretch">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-3">
                  <h3 className="h5 font-bold! capitalize">Cloud {planName}</h3>

                  {isTrial && isCurrentPlan && trialEnd && (
                    <>
                      <div className="flex-1" />
                      <Badge variant="default">
                        <InfoIcon />
                        {getTrialDaysLeft(trialEnd)}
                      </Badge>
                    </>
                  )}

                  {!isFreePlan && isCurrentPlan && isExpired && (
                    <Badge variant="destructive">
                      <TriangleAlertIcon />
                      Expired
                    </Badge>
                  )}
                </div>

                <span className="flex flex-wrap items-start gap-0.5">
                  <span className="text-2xl font-bold">
                    {isFreePlan ? "$0" : "$29"}
                  </span>
                  <span className="pt-3 text-xs font-bold">/month</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full">
            {!isCurrentPlan && isFreePlan && (
              <SubscriptionButton
                variant="outline"
                buttonText="Downgrade"
                className={cn("w-full flex-1 shadow-none")}
                disabled={isTrial}
              />
            )}

            {!isCurrentPlan && isProPlan && (
              <SubscriptionButton
                variant="default"
                buttonText="Upgrade to Cloud Pro"
                className="w-full flex-1 shadow-none"
              />
            )}

            {isCurrentPlan && (
              <SubscriptionButton
                variant={isTrial ? "default" : "outline"}
                buttonText={
                  isTrial ? "Subscribe to Cloud Pro" : "Your current plan"
                }
                className="w-full flex-1 opacity-100! shadow-none"
                disabled={isTrial ? false : true}
              />
            )}
          </div>

          <div className="text-primary flex flex-col items-stretch space-y-2 text-sm font-normal">
            {features.map((feature) => (
              <div key={feature} className={cn("flex items-center gap-1.5")}>
                <CheckIcon className="size-4!" />
                <span>{feature}</span>
                {(feature.includes("Slack") || feature.includes("Email")) && (
                  <Badge variant="secondary">Coming soon</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {isProPlan && isCurrentPlan && !isTrial && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute! top-2 right-2">
                <SubscriptionButton
                  size="icon"
                  variant="ghost"
                  icon={<SettingsIcon className="" />}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>Manage subscription</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }
}
