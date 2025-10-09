"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs-underlined";
import Link from "next/link";
import { ReactNode } from "react";
import { UpgradeAlert } from "@/components/ui/upgrade-alert";
import { useSubscription } from "@/hooks/use-subscription";

export default function AdminInsightsPage({
  children,
}: {
  children: ReactNode;
}) {
  const { isAdmin } = useAuth();
  const platformUrl = usePlatformUrl();
  const pathname = usePathname();
  const basePath = `${platformUrl}/admin/insights`;

  const {
    query: { data: subscription, isPending },
  } = useSubscription();

  if (isAdmin && subscription && !isPending) {
    const { isExpired, name: subscriptionName } = subscription;
    const hasAccess = !!(subscriptionName === "pro" && !isExpired);

    if (!hasAccess) {
      return (
        <UpgradeAlert
          title={
            isExpired
              ? "Your subscription is expired"
              : "You free trial has ended"
          }
          description={
            isExpired
              ? "Please update your subscription to continue using AI Insights."
              : "Please upgrade your subscription to continue using AI Insights."
          }
          buttonText={isExpired ? "Update subscription" : "Upgrade"}
        />
      );
    }

    return (
      <div className="-mt-2!">
        <Tabs className="" value={pathname?.split("/")?.pop() || "ai-roadmap"}>
          <TabsList className="">
            <TabsTrigger value="ai-roadmap" asChild>
              <Link href={`${basePath}/ai-roadmap`}>AI Roadmap</Link>
            </TabsTrigger>

            <TabsTrigger value="ai-explorer" asChild>
              <Link href={`${basePath}/ai-explorer`}>AI Explorer</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="pt-5">{children}</div>
      </div>
    );
  }
}
