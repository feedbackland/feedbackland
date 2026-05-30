"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ActivityFeedLoading() {
  return (
    <div className="flex flex-col items-stretch">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="border-border flex items-start gap-3 border-b py-4 pr-2 pl-3 last:border-b-0"
        >
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-[55%]" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
