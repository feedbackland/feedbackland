"use client";

import { cn } from "@/lib/utils";

export function FeedbackFormBanner({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-lg border border-border bg-background p-3 text-sm leading-5 text-muted-foreground shadow-sm transition-colors ease-out hover:border hover:border-primary",
        className,
      )}
      onClick={onClick}
    >
      Share your feedback
    </div>
  );
}
