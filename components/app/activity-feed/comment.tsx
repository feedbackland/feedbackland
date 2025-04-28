"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { ArrowBigUpIcon } from "lucide-react";

export function ActivityFeedComment({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* <div>
        <div className="flex items-center pr-3 pl-2">
          <MessageSquareIcon className="text-muted-foreground size-4.5" />
        </div>
      </div> */}
      <div className="flex-1 space-y-1">
        <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
          <span className="">Comment posted in {item.postTitle}</span>
          <span className="text-[8px]">•</span>
          <span className="">
            {timeAgo.format(item.createdAt)} by{" "}
            {item.authorName || "unknown user"}
          </span>
        </div>
        <TiptapOutput
          content={item.content}
          forbiddenTags={["a", "pre", "img"]}
          className={cn("", !item?.isSeen && "font-bold!")}
        />
      </div>
      <div>
        <div className="flex items-center gap-1">
          <ArrowBigUpIcon className="size-4" strokeWidth={1.5} />
          <span className="text-primary text-xs">{item.upvotes || 0}</span>
        </div>
      </div>
    </div>
  );
}
