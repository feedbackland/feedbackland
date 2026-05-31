"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors <Settings />: one bordered card with 6 divided rows (border-b py-5 px-4,
// last border-b-0). Each row is a two-column layout (flex items-start gap-6): a
// left column with label / description / value, and a right "Edit" button offset
// by -mt-2.5. The first (Logo) row swaps the value for a size-[100px] dropzone.
const ROW = "border-border relative w-full border-b py-5 px-4";

function TextRow({ last }: { last?: boolean }) {
  return (
    <div className={cn(ROW, last && "border-b-0")}>
      <div className="flex items-start gap-6">
        <div className="flex flex-1 flex-col items-stretch space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-full max-w-md" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="-mt-2.5 h-8 w-16 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

export function SettingsLoading() {
  return (
    <div className="bg-background border-border rounded-lg border shadow-xs">
      {/* Logo */}
      <div className={ROW}>
        <div className="flex items-start gap-6">
          <div className="flex flex-1 flex-col items-stretch gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="size-[100px] rounded-md" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      </div>

      {/* OrgName, OrgUrl, PlatformTitle, PlatformDescription */}
      <TextRow />
      <TextRow />
      <TextRow />
      <TextRow />

      {/* PlatformUrl */}
      <TextRow last />
    </div>
  );
}
