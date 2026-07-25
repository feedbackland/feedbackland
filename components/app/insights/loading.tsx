"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the real page: header with a one-line description and a single
// action, the run strip at the head of the list, then rows of title + signal
// meter, a description, and the meta line with the status control.
const TITLE_WIDTHS = ["w-2/5", "w-1/2", "w-1/3", "w-[45%]", "w-2/5"];

/**
 * `showHeader` is off when a real header is already on screen — generating from
 * the empty state, where only the list underneath it is still to come.
 */
export function InsightsLoading({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  return (
    <div>
      {showHeader && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-28 shrink-0" />
        </div>
      )}

      <div className="border-border bg-background overflow-hidden rounded-lg border shadow-xs">
        <div className="border-border bg-muted/40 flex items-center justify-between gap-4 border-b px-4 py-2.5 sm:px-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-20 shrink-0" />
        </div>

        {TITLE_WIDTHS.map((width, index) => (
          <div
            key={index}
            className="border-border border-b px-4 py-4 last:border-b-0 sm:px-5"
          >
            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className={cn("h-4", width)} />
                <Skeleton className="h-3.5 w-9 shrink-0" />
              </div>
              <Skeleton className="h-3.5 w-full max-w-xl" />
              <Skeleton className="h-3.5 w-2/3 max-w-md" />
              <div className="flex items-center justify-between gap-4 pt-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-7 w-28 shrink-0 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
