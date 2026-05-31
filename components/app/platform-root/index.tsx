"use client";

import { useIsDrawerEmbed } from "@/providers/embed";
import { cn } from "@/lib/utils";
import { PlatformHeader } from "@/components/app/platform-header";
import { PlatformHeaderDrawer } from "@/components/app/platform-header/drawer";

export default function PlatformRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inside the slide-in drawer widget the panel is dedicated to giving feedback:
  // it uses tighter padding and replaces the board's full page header (org
  // title, navigation, account/theme controls) with a minimal "Share your
  // feedback" title. Both behaviours key off the explicit `embed=drawer` signal
  // (not merely being in an iframe) so the standalone board is unaffected if it
  // is ever embedded some other way.
  const isDrawerEmbed = useIsDrawerEmbed();

  return (
    <div
      className={cn(
        "m-auto flex w-full max-w-5xl grow flex-col items-stretch",
        {
          "xs:px-8 px-4 py-4": isDrawerEmbed,
          "mt-4 mb-10 px-3 sm:mt-5": !isDrawerEmbed,
        },
      )}
    >
      {isDrawerEmbed ? <PlatformHeaderDrawer /> : <PlatformHeader />}
      {children}
    </div>
  );
}
