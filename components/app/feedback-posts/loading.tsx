"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the real feedback list: one bordered card (no padding of its own) whose
// rows each carry `border-b py-5 pr-3.5 pl-4` — matching <FeedbackPostCompact />.
// Each row stacks (gap-3.5): a meta line + title, a clamped body, and an action
// row of two h-[25px] buttons (upvote + comments).
const ROWS = [
  ["w-3/5", ["w-full", "w-full", "w-11/12"]],
  ["w-2/5", ["w-full", "w-3/4"]],
  ["w-1/2", ["w-full", "w-full", "w-4/5"]],
  ["w-[55%]", ["w-full", "w-2/3"]],
] as const;

export function FeedbackPostsLoading() {
  return (
    <div className="border-border bg-background rounded-lg border shadow-xs">
      {ROWS.map(([titleWidth, bodyWidths], i) => (
        <div
          key={i}
          className={cn(
            "border-border border-b py-5 pr-3.5 pl-4",
            i === ROWS.length - 1 && "border-b-0",
          )}
        >
          <div className="flex flex-col items-stretch gap-3.5">
            <div className="flex flex-col items-stretch gap-1.5">
              {/* meta line: time • category • status (text-xs) */}
              <Skeleton className="h-3 w-40" />
              {/* title (text-[17px] leading-5) */}
              <Skeleton className={cn("h-5", titleWidth)} />
            </div>

            {/* body (line-clamp-4) */}
            <div className="space-y-2">
              {bodyWidths.map((w, j) => (
                <Skeleton key={j} className={cn("h-4", w)} />
              ))}
            </div>

            {/* actions: upvote + comments (both h-[25px]) */}
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-[25px] w-14 rounded-md" />
              <Skeleton className="h-[25px] w-14 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
