"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Badge } from "@/components/ui/badge";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import Link from "next/link";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function ActivityFeedListItem({
  item,
  className,
}: {
  item: ActivityFeedItem;
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

  const { status, type, category, createdAt, title, content, postId } = item;

  return (
    <div
      className={cn(
        "group border-b-border flex w-full flex-1 items-center gap-6 border px-4 py-5",
        item.isSeen && "bg-muted/80 dark:bg-muted/50",
        className,
      )}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex flex-col items-stretch">
          <div className="mb-1 -ml-0.5 flex items-center gap-1.5">
            <Badge variant="outline" className="text-muted-foreground">
              {capitalizeFirstLetter(
                type === "comment" ? type : category || "",
              )}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {timeAgo.format(createdAt)}
            </Badge>
            {status && (
              <Badge
                variant="outline"
                className={cn("h-fit px-1.5 py-0.5 text-xs shadow-none", {
                  "text-under-consideration!": status === "under consideration",
                  "text-planned!": status === "planned",
                  "text-in-progress!": status === "in progress",
                  "text-done!": status === "done",
                  "text-declined!": status === "declined",
                })}
              >
                {capitalizeFirstLetter(status)}
              </Badge>
            )}
          </div>
          <Link
            key={item.id}
            href={`${platformUrl}/${item.postId}`}
            onClick={() => handleOnClick(item.id)}
          >
            <h3 className={cn("mb-2 text-base font-semibold hover:underline")}>
              {title}
            </h3>
          </Link>
          <TiptapOutput
            content={content}
            forbiddenTags={["a", "pre", "img"]}
            className={cn("line-clamp-4")}
          />
        </div>
        <div>
          <FeedbackPostOptionsMenu postId={postId} className="-mt-3" />
        </div>
      </div>
    </div>
  );
}
