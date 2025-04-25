"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ActivityFeedLoading() {
  return (
    <div className="">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="border-border space-y-2 border-t p-4">
          <Skeleton className="h-4 w-[60%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
