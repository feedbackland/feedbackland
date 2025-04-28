"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { ActivityFeedPost } from "./post";
import { ActivityFeedComment } from "./comment";
import Link from "next/link";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function ActivityFeedListItems({
  items,
  className,
}: {
  items: ActivityFeedItem[] | undefined;
  className?: React.ComponentProps<"div">["className"];
}) {
  const trpc = useTRPC();
  const platformUrl = usePlatformUrl();
  const setActivitySeen = useMutation(trpc.setActivitiesSeen.mutationOptions());

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      {items?.map((item) => {
        if (item.type === "post") {
          return (
            <Link
              key={item.id}
              href={`${platformUrl}/${item.postId}`}
              onClick={() => {
                setActivitySeen?.mutate({
                  itemIds: [item.id],
                });
              }}
            >
              <ActivityFeedPost
                item={item}
                className="border-border flex-1 border-b p-4"
              />
            </Link>
          );
        }

        if (item.type === "comment") {
          return (
            <Link
              key={item.id}
              href={`${platformUrl}/${item.postId}`}
              onClick={() => {
                setActivitySeen?.mutate({
                  itemIds: [item.id],
                });
              }}
            >
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
