"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function InsightPostsLoading() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col items-stretch space-y-2 py-3 first:pt-0 last:pb-0"
        >
          <Skeleton className="h-4 w-full max-w-full" />
          <Skeleton className="h-4 w-[100px] max-w-full" />
        </div>
      ))}
    </div>
  );
}
