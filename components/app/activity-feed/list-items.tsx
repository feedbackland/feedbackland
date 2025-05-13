"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { ActivityFeedListItem } from "./list-item";

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
        return <ActivityFeedListItem key={item.id} item={item} />;
      })}
    </div>
  );
}
