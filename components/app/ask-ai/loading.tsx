"use client";

import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the assistant-ui <Thread /> empty state (components/ui/assistant-ui/
// thread.tsx): a tall bordered card the height of the chat viewport, with a
// centered welcome (title + subtitle + 2x2 suggested-prompt grid) and a bottom
// composer bar. The card height matches the real `h-[calc(100dvh-200px)]`.
export function AskAILoading() {
  return (
    <div className="bg-background border-border relative flex h-[calc(100dvh-200px)] w-full flex-col overflow-hidden rounded-lg border shadow-xs">
      {/* centered welcome */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Skeleton className="mb-1.5 h-7 w-64" />
        <Skeleton className="mb-6 h-4 w-72" />
        <div className="grid w-full max-w-lg grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* composer */}
      <div className="mx-auto w-full max-w-[44rem] px-4 pt-6 pb-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}
