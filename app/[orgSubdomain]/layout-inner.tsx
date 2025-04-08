"use client";

import { ClaimOrgBanner } from "@/components/app/claim-org/banner";
import { PlatformHeader } from "@/components/app/platform-header";
import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";

export default function OrgLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const inIframe = useInIframe();

  if (inIframe === null) {
    return null;
  }

  return (
    <>
      <ClaimOrgBanner />
      <div
        className={cn(
          "m-auto flex w-full max-w-full grow flex-col",
          inIframe === false && "mt-10",
        )}
      >
        <PlatformHeader />
        {children}
      </div>
    </>
  );
}
