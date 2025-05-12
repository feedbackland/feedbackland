"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function InsightsLoading() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="border-border flex flex-col items-stretch gap-2 rounded-xl border p-5"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>

          <Skeleton className="h-6 max-w-[200px]" />

          <div className="mt-2 flex w-full flex-1 flex-col items-stretch space-y-2">
            <Skeleton className="h-4 w-full max-w-full" />
            <Skeleton className="h-4 w-full max-w-full" />
            <Skeleton className="h-4 w-full max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
