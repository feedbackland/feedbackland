"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { ArrowBigUpIcon, MessageSquare } from "lucide-react";

export function ActivityFeedPost({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("group", className)}>
      <div className="flex-1 space-y-1.5">
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

        <h3
          className={cn(
            "text-base font-semibold",
            !item?.isSeen && "font-bold!",
          )}
        >
          {item.title}
        </h3>

        <TiptapOutput
          content={item.content}
          forbiddenTags={["a", "pre", "img"]}
          className={cn("", !item?.isSeen && "font-semibold!")}
        />

        {/* <div className="flex items-center gap-2 text-xs">
          {[
            "under-consideration",
            "planned",
            "in-progress",
            "done",
            "declined",
          ].map((status) => {
            return (
              <Button
                key={status}
                size="sm"
                variant="outline"
                className={cn(
                  "h-fit px-2 py-1 text-xs shadow-none",
                  // `text-${status}`,
                )}
              >
                {capitalizeFirstLetter(status.replace("-", " "))}
              </Button>
            );
          })}
        </div> */}
      </div>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-1">
          <ArrowBigUpIcon className="size-4!" strokeWidth={1.5} />
          <span className="text-primary text-xs">{item.upvotes || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="mr-0.5 ml-0.5 size-3!" />
          <span className="text-primary text-xs">0</span>
        </div>
      </div>
    </div>
  );
}
