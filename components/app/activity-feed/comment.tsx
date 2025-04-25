"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { ArrowBigUpIcon, MessageSquare, MessageSquareIcon } from "lucide-react";

export function ActivityFeedComment({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div>
        <div className="flex items-center">
          <MessageSquareIcon className="size-4" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
          <span className="text-primary">Comment</span>
          <span className="text-[8px]">•</span>
          <span className="text-primary">{item.postTitle}</span>
          <span className="text-[8px]">•</span>
          <span className="">
            {timeAgo.format(item.createdAt)} by{" "}
            {item.authorName || "unknown user"}
          </span>
        </div>
        <TiptapOutput content={item.content} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <ArrowBigUpIcon className="size-4" />
          <span className="text-primary">{item.upvotes || 0}</span>
        </div>
      </div>
    </div>
  );
}
