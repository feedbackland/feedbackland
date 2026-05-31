"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors <ActivityFeedListItem />: rows with a left accent stripe (border-l-2,
// transparent here vs. blue when unseen), a category icon, a two-line title/meta
// column (gap-0.5), and a trailing options-menu slot. Rendered inside the list's
// bordered card, so this provides only the rows.
const WIDTHS = [
  ["w-[55%]", "w-[38%]"],
  ["w-[42%]", "w-[30%]"],
  ["w-[60%]", "w-[34%]"],
  ["w-[48%]", "w-[28%]"],
  ["w-[52%]", "w-[40%]"],
  ["w-[38%]", "w-[26%]"],
  ["w-[58%]", "w-[32%]"],
  ["w-[45%]", "w-[36%]"],
] as const;

export function ActivityFeedLoading() {
  return (
    <div className="flex flex-col items-stretch">
      {WIDTHS.map(([titleW, metaW], i) => (
        <div
          key={i}
          className="border-border flex items-start gap-2.5 border-b border-l-2 border-l-transparent py-3 pr-2 pl-3 last:border-b-0"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            {/* category icon */}
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {/* title (text-sm) */}
              <Skeleton className={cn("h-4", titleW)} />
              {/* author • time • status (text-xs) */}
              <Skeleton className={cn("h-3", metaW)} />
            </div>
          </div>
          {/* trailing options-menu slot */}
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}
