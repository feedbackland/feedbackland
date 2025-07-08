"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function FeedbackPostsLoading() {
  return (
    <div className="mt-2 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-[24px] w-[40px]" />
          <Skeleton className="h-[24px] w-[40px]" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-[24px] w-[40px]" />
          <Skeleton className="h-[24px] w-[40px]" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-[24px] w-[40px]" />
          <Skeleton className="h-[24px] w-[40px]" />
        </div>
      </div>
    </div>
  );
}
