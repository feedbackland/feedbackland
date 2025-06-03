"use client";

import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import { RedeemAdminInvitation } from "@/components/app/redeem-admin-invitation";
import { SetColorMode } from "@/components/app/set-color-mode";
import dynamic from "next/dynamic";

const PlatformHeader = dynamic(() =>
  import("../../components/app/platform-header").then(
    ({ PlatformHeader }) => PlatformHeader,
  ),
);

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const inIframe = useInIframe();

  // wait until deteremined if in iframe
  if (inIframe === null) {
    return null;
  }

  return (
    <>
      <ClaimOrgBanner />
      <RedeemAdminInvitation />
      <SetColorMode />

      <div
        className={cn(
          "m-auto flex w-full grow flex-col",
          inIframe ? "px-8 py-6" : "mt-10 mb-10 max-w-[800px] px-5",
        )}
      >
        <PlatformHeader />
        {children}
      </div>
    </>
  );
}
