"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Mirrors the <Insight /> card: bg-background, gap-0/py-0 override, a header with
// the title (col 1) + a priority badge as CardAction (col 2, rounded-md outline),
// a meta row (status badge + upvote/comment counts), a 1–2 line description, and
// the collapsible "Based on N feedback posts" footer (border-t). Badges are
// rounded-md (not pills) to match the real outline <Badge />.
const TITLE_WIDTHS = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-[70%]"] as const;

export function InsightsLoading() {
  return (
    <div className="space-y-6">
      {/* Filter bar: search + sort */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Insight cards */}
      <div className="space-y-6">
        {TITLE_WIDTHS.map((titleW, index) => (
          <Card
            key={index}
            className="bg-background gap-0 overflow-hidden py-0"
          >
            <CardHeader className="pt-5">
              <Skeleton className={cn("h-5", titleW)} />
              <CardAction>
                <Skeleton className="h-5 w-24 rounded-md" />
              </CardAction>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-3 pb-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
            {/* collapsible "Based on N feedback posts" footer */}
            <div className="border-border border-t px-6 py-3">
              <Skeleton className="h-3 w-44" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
