"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ASK_AI_THREAD_HEIGHT } from "@/components/app/ask-ai/thread";
import { cn } from "@/lib/utils";

/**
 * Stands in for the whole page while the admin role is still resolving.
 *
 * Mirrors the real layout closely enough that nothing jumps when it is replaced:
 * the heading block, then the thread card at exactly the same height, with the
 * welcome, the composer and the three example questions stacked in the middle.
 */
export function AskAiLoading() {
  return (
    <div>
      <div className="mb-5">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div
        className={cn(
          "bg-background border-border flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border px-4 shadow-xs sm:px-6",
          ASK_AI_THREAD_HEIGHT,
        )}
      >
        <div className="flex w-full max-w-[44rem] flex-col items-center gap-2.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mb-4 h-4 w-64" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
