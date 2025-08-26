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
          inIframe ? "py-6 pt-10 pb-6" : "mt-4 mb-10 px-3 sm:mt-5 sm:max-w-2xl",
        )}
      >
        <div>
          <ClaimOrgBanner className="mb-6 rounded-md" />
          <PlatformHeader />
          {children}
        </div>
      </div>
    );
  }

  return null;
}
