"use client";

import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
// import { PlatformHeader } from "@/components/app/platform-header";
import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import { RedeemAdminInvitation } from "@/components/app/redeem-admin-invitation";
import { useOrg } from "@/hooks/use-org";
import { SetColorMode } from "@/components/app/set-color-mode";
import dynamic from "next/dynamic";

const PlatformHeader = dynamic(() =>
  import("../../components/app/platform-header").then(
    ({ PlatformHeader }) => PlatformHeader,
  ),
);

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const {
    query: { isPending },
  } = useOrg();

  const inIframe = useInIframe();

  // don't render yet if not yet deteremined if in iframe, or if org not yet loaded
  if (inIframe === null || isPending === true) {
    return null;
  }

  return (
    <>
      <ClaimOrgBanner />
      <RedeemAdminInvitation />
      <SetColorMode />

      <div
        className={cn(
          "m-auto flex w-full max-w-full grow flex-col p-0.5",
          inIframe === false && "mt-10 mb-10 max-w-[800px] px-5 py-0",
        )}
      >
        <PlatformHeader />
        {children}
      </div>
    </>
  );
}
