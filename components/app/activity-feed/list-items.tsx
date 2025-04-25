"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";

export function ActivityFeedListItems({
  items,
  className,
}: {
  items: ActivityFeedItem[];
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("space-y-8", className)}>
      {items?.map(({ id, content }) => (
        <TiptapOutput key={id} content={content} />
      ))}
    </div>
  );
}
