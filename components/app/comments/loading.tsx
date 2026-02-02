"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CommentsLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex gap-2 py-4 first:pt-0 last:pb-0"
          >
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex w-full flex-1 flex-col items-stretch gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton
                className="h-4"
                style={{ width: `${75 - index * 15}%` }}
              />
              <div className="flex items-center gap-3 pt-0.5">
                <Skeleton className="h-3.5 w-8" />
                <Skeleton className="h-3.5 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
