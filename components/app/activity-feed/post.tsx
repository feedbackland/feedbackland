"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { ArrowBigUpIcon, MessageSquare } from "lucide-react";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";

export function ActivityFeedPost({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("group", className)}>
      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h3
              className={cn(
                "text-base font-medium",
                !item.isSeen && "font-bold",
              )}
            >
              {item.title}
            </h3>

            <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-normal">
              <span className="">
                {capitalizeFirstLetter(
                  item.category || "uncategorized feedback",
                )}
              </span>
              <span className="text-[8px]">•</span>
              <span className="">
                {timeAgo.format(item.createdAt, "twitter")}
              </span>
              <span className="text-[8px]">•</span>
              <div className="flex items-center gap-1">
                <ArrowBigUpIcon className="size-3.5!" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">
                  {item.upvotes || 0}
                </span>
              </div>
              <span className="text-[8px]">•</span>
              <div className="flex items-center gap-1">
                <MessageSquare className="mr-0.5 ml-0.5 size-2.5!" />
                <span className="text-muted-foreground text-xs">0</span>
              </div>
            </div>
          </div>
          <FeedbackPostOptionsMenu postId={item.postId} />
        </div>

        <TiptapOutput
          content={item.content}
          forbiddenTags={["a", "pre", "img"]}
          className={cn(
            "text-muted-foreground! line-clamp-4",
            !item.isSeen && "font-bold!",
          )}
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
                  "h-fit bg-transparent px-2 py-1 text-xs shadow-none",
                  // `text-${status}`,
                )}
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                {capitalizeFirstLetter(status.replace("-", " "))}
              </Button>
            );
          })}
        </div> */}
      </div>
    </div>
  );
}
