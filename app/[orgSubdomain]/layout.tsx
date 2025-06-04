"use client";

import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import { ProcessAdminInviteParams } from "@/components/app/process-admin-invite-params";
import { ProcessModeParam } from "@/components/app/process-mode-param";
import dynamic from "next/dynamic";

const PlatformHeader = dynamic(() =>
  import("../../components/app/platform-header").then(
    ({ PlatformHeader }) => PlatformHeader,
  ),
);

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const inIframe = useInIframe();

  // wait until determined if in iframe
  if (inIframe === null) {
    return null;
  }

  return (
    <>
      <ClaimOrgBanner />
      <ProcessAdminInviteParams />
      <ProcessModeParam />

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
