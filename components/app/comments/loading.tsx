"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CommentsLoading() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex-start flex gap-2">
          <Skeleton className="size-7 rounded-full" />
          <div className="mt-2 flex w-full flex-1 flex-col items-stretch space-y-2">
            <Skeleton className="h-4 w-full max-w-[150px]" />
            <Skeleton className="h-4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-[30px]" />
              <Skeleton className="h-4 w-full max-w-[60px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
