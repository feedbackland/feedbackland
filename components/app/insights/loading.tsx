"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardAction,
  CardContent,
} from "@/components/ui/card";

export function InsightsLoading() {
  return (
    <div className="space-y-6">
      {/* Filter Bar Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Card Skeletons */}
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="gap-0 py-0">
            <CardHeader className="pt-5">
              <Skeleton className="h-5 w-3/4" />
              <CardAction>
                <Skeleton className="h-5 w-20 rounded-full" />
              </CardAction>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-3 pb-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
