"use client";

import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import { PlatformHeader } from "@/components/app/platform-header";
import { ClaimOrgBanner } from "@/components/app/claim-org-banner";

export default function PlatformRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  const inIframe = useInIframe();

  if (inIframe !== null) {
    return (
      <div
        className={cn(
          "m-auto flex w-full grow flex-col justify-between",
          inIframe
            ? "min-h-dvh px-8 py-6"
            : "mt-10 mb-10 h-[calc(100vh-80px)] max-w-[800px] px-5",
        )}
      >
        <div>
          <PlatformHeader />
          {children}
        </div>
        <ClaimOrgBanner className="mt-4 -mb-1" />
      </div>
    );
  }

  return null;
}
