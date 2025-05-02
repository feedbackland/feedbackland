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
        queryClient.refetchQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        queryClient.refetchQueries({
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
          "border-border border flex-1 px-4 py-5 flex w-full items-center gap-4 hover:bg-muted/50 hover:dark:bg-muted/40 hover:border-primary",
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
