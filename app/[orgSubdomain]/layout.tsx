"use client";

import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";
import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import { RedeemAdminInvitation } from "@/components/app/redeem-admin-invitation";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const inIframe = useInIframe();

  // don't render yet if not yet deteremined if in iframe
  if (inIframe === null) {
    return null;
  }

  return (
    <>
      <ClaimOrgBanner />
      <RedeemAdminInvitation />
      <div
        className={cn(
          "m-auto flex w-full max-w-full grow flex-col px-10 py-5",
          inIframe === false && "mt-10 mb-10 max-w-[800px] px-5 py-0",
        )}
      >
        <PlatformHeader />
        {children}
      </div>
    </>
  );
}
