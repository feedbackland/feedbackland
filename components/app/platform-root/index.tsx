"use client";

import { useInIframe } from "@/hooks/use-in-iframe";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const PlatformHeader = dynamic(() =>
  import("../platform-header").then(({ PlatformHeader }) => PlatformHeader),
);

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
          "m-auto flex w-full grow flex-col",
          inIframe ? "px-8 py-6" : "mt-10 mb-10 max-w-[800px] px-5",
        )}
      >
        <PlatformHeader />
        {children}
      </div>
    );
  }

  return null;
}
