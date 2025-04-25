"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
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
      {/* <div>
        <div className="flex items-center pr-3 pl-2">
          <LightbulbIcon className="text-muted-foreground size-4.5" />
        </div>
      </div> */}
      <div className="flex-1 space-y-2.5">
        <div className="space-y-0.5">
          <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
            <span className="">
              {capitalizeFirstLetter(item.category || "uncategorized feedback")}
            </span>
            <span className="text-[8px]">•</span>
            <span className="">
              {timeAgo.format(item.createdAt)} by{" "}
              {item.authorName || "unknown user"}
            </span>
          </div>
          <h3 className="text-base font-semibold">{item.title}</h3>
        </div>
        <TiptapOutput
          content={item.content}
          forbiddenTags={["a", "pre", "img"]}
        />
        <div className="flex items-center gap-2 text-xs">
          {/* <span className="text-muted-foreground">Status:</span> */}
          <Button size="sm" variant="outline" className="h-fit px-2 py-1">
            Under consideration
          </Button>
          <Button size="sm" variant="outline" className="h-fit px-2 py-1">
            Planned
          </Button>
          <Button size="sm" variant="outline" className="h-fit px-2 py-1">
            In porgress
          </Button>
          <Button size="sm" variant="outline" className="h-fit px-2 py-1">
            Done
          </Button>
          <Button size="sm" variant="outline" className="h-fit px-2 py-1">
            Declined
          </Button>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1">
          <ArrowBigUpIcon className="size-4" />
          <span className="text-primary text-xs">{item.upvotes || 0}</span>
        </div>
      </div>
    </div>
  );
}
