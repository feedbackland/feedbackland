"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { ActivityFeedPost } from "./post";
import { ActivityFeedComment } from "./comment";
import Link from "next/link";
import { usePlatformUrl } from "@/hooks/use-platform-url";

export function ActivityFeedListItems({
  items,
  className,
}: {
  items: ActivityFeedItem[] | undefined;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      {items?.map((item) => {
        if (item.type === "post") {
          return (
            <Link key={item.id} href={`${platformUrl}/${item.postId}`}>
              <ActivityFeedPost
                item={item}
                className="border-border flex-1 border-b p-4"
              />
            </Link>
          );
        }

        if (item.type === "comment") {
          return (
            <Link key={item.id} href={`${platformUrl}/${item.postId}`}>
              <ActivityFeedComment
                key={item.id}
                item={item}
                className="border-border flex-1 border-b p-4"
              />
            </Link>
          );
        }

        return null;
      })}
    </div>
  );
}
