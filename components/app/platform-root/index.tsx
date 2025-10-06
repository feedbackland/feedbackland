"use client";

import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import { PlatformHeader } from "@/components/app/platform-header";

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
            ? "xs:px-8 px-4 py-4"
            : "mt-4 mb-10 px-3 sm:mt-5 sm:max-w-3xl",
        )}
      >
        <div>
          <PlatformHeader />
          {children}
        </div>
      </div>
    );
  }

  return null;
}
