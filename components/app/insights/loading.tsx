"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors <InsightRow />: title + signal meter, a description, and the meta line
// with the status control on the right.
const TITLE_WIDTHS = ["w-2/5", "w-1/2", "w-1/3", "w-[45%]", "w-2/5"];

export function InsightsLoading() {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="size-9" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="border-border bg-background rounded-lg border shadow-xs">
        {TITLE_WIDTHS.map((width, index) => (
          <div
            key={index}
            className="border-border border-b px-3 py-3.5 last:border-b-0 sm:px-4"
          >
            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className={cn("h-4", width)} />
                <Skeleton className="h-1 w-9 shrink-0 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-7 w-28 shrink-0 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
