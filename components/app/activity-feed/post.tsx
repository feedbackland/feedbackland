"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { ArrowBigUpIcon, LightbulbIcon } from "lucide-react";

export function ActivityFeedPost({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex w-full flex-1 items-center gap-2", className)}>
      <div>
        <div className="flex items-center">
          <LightbulbIcon className="size-4" />
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
          <span className="text-primary">{item.type}</span>
          <span className="text-[8px]">•</span>
          <span className="">
            {timeAgo.format(item.createdAt)} by{" "}
            {item.authorName || "unknown user"}
          </span>
        </div>
        <h3 className="large font-semibold">{item.title}</h3>
        <TiptapOutput content={item.content} />
        <div className="flex items-center gap-2">
          <span className="">Status:</span>
          <Button size="sm" variant="outline">
            Under consideration
          </Button>
          <Button size="sm" variant="outline">
            Planned
          </Button>
          <Button size="sm" variant="outline">
            In porgress
          </Button>
          <Button size="sm" variant="outline">
            Done
          </Button>
          <Button size="sm" variant="outline">
            Declined
          </Button>
        </div>
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
