"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { ActivityFeedPost } from "./post";
import { ActivityFeedComment } from "./comment";
import Link from "next/link";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function ActivityFeedListItems({
  items,
  className,
}: {
  items: ActivityFeedItem[] | undefined;
  className?: React.ComponentProps<"div">["className"];
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const platformUrl = usePlatformUrl();
  const setActivitySeen = useMutation(
    trpc.setActivitiesSeen.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeedMetaData.queryKey(),
        });
      },
    }),
  );

  const handleOnClick = (itemId: string) => {
    setActivitySeen?.mutate({
      itemIds: [itemId],
    });
  };

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      {items?.map((item) => {
        const itemClassName = cn(
          "border-border flex-1 border-b p-4 flex w-full items-center gap-2",
          item.isSeen && "bg-muted/50 dark:bg-muted/40",
        );

        if (item.type === "post") {
          return (
            <Link
              key={item.id}
              href={`${platformUrl}/${item.postId}`}
              onClick={() => handleOnClick(item.id)}
            >
              <ActivityFeedPost item={item} className={itemClassName} />
            </Link>
          );
        }

        if (item.type === "comment") {
          return (
            <Link
              key={item.id}
              href={`${platformUrl}/${item.postId}`}
              onClick={() => handleOnClick(item.id)}
            >
              <ActivityFeedComment
                key={item.id}
                item={item}
                className={itemClassName}
              />
            </Link>
          );
        }

        return null;
      })}
    </div>
  );
}
