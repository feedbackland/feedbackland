"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { ActivityFeedPost } from "./post";
import { ActivityFeedComment } from "./comment";

export function ActivityFeedListItems({
  items,
  className,
}: {
  items: ActivityFeedItem[] | undefined;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      {items?.map((item) => {
        if (item.type === "post") {
          return (
            <ActivityFeedPost
              key={item.id}
              item={item}
              className="border-border flex-1 border-b p-4"
            />
          );
        }

        if (item.type === "comment") {
          return (
            <ActivityFeedComment
              key={item.id}
              item={item}
              className="border-border flex-1 border-b p-4"
            />
          );
        }

        return null;
      })}
    </div>
  );
}
