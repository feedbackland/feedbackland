"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";

export function ActivityFeedPost({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("", className)}>
      <h3 className="h3">{item.title}</h3>
      <TiptapOutput content={item.content} />
      <div>Status: </div>
    </div>
  );
}
