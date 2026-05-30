"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ActivityFeedLoading() {
  return (
    <div className="flex flex-col items-stretch">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="border-border flex items-start gap-2.5 border-b py-3 pr-2 pl-3 last:border-b-0"
        >
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-[45%]" />
            <Skeleton className="h-3 w-[30%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
