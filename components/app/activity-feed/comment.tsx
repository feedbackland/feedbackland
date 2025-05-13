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
    <div className={cn("group", className)}>
      <div className="flex-1 space-y-3">
        <div className="flex-1 space-y-0.5">
          <TiptapOutput
            content={item.content}
            forbiddenTags={["a", "pre", "img"]}
            className={cn("line-clamp-4 group-hover:underline")}
          />

          <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs font-normal">
            <span className="">Comment</span>
            {/* <span className="text-[8px]">•</span>
            <span className="break-normal">{item.postTitle}</span> */}
            <span className="text-[8px]">•</span>
            <span className="">{timeAgo.format(item.createdAt)}</span>
            <span className="text-[8px]">•</span>
            <div className="flex items-center gap-0.5">
              <ArrowBigUpIcon className="size-4!" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs">
                {item.upvotes || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
