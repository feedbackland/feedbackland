"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function InsightPostsLoading() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex flex-col items-stretch space-y-0">
          <Skeleton className="h-4 w-full max-w-full" />
        </div>
      ))}
    </div>
  );
}
