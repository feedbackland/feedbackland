"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";

export function ActivityFeedComment({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("", className)}>
      {/* <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
        <div className="text-primary">{authorName}</div>
        <span className="text-[8px]">•</span>
        <div className="">{timeAgo.format(createdAt)}</div>
      </div> */}
      <TiptapOutput content={item.content} />
    </div>
  );
}
