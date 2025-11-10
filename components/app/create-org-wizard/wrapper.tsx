"use client";

import { FeedbacklandLogoFull } from "@/components/ui/logos";

export function CreateOrgWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted dark:bg-background m-auto flex min-h-dvh w-dvw flex-col items-center px-4 py-14">
      <FeedbacklandLogoFull className="fill-primary-foreground! mb-8 w-[165px]" />
      {children}
    </div>
  );
}
