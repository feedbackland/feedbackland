"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { Badge } from "@/components/ui/badge";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import Link from "next/link";
import { CommentsOptionsMenu } from "../comment/options-menu";
import { useSetActivitiesSeen } from "@/hooks/use-set-activities-seen";
import { usePlatformUrl } from "@/hooks/use-platform-url";

export function ActivityFeedListItem({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();
  const setActivitySeen = useSetActivitiesSeen();

  const { status, type, category, createdAt, title, content, postId } = item;

  const handleOnClick = (itemId: string) => {
    setActivitySeen?.mutate({
      itemIds: [itemId],
    });
  };

  return (
    <div
      className={cn(
        "group border-b-border flex w-full flex-1 items-center gap-6 border px-4 py-5",
        item.isSeen && "bg-muted/50",
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
                className={cn("", {
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
            <h3
              className={cn(
                "mb-2 flex items-center gap-2.5 text-base font-semibold hover:underline",
              )}
            >
              <span>{title}</span>
              {!item.isSeen && (
                <span className="size-1.5 rounded-full bg-blue-600" />
              )}
            </h3>
          </Link>
          <TiptapOutput
            content={content}
            forbiddenTags={["a", "pre", "img"]}
            className={cn("line-clamp-4")}
          />
        </div>
        <div className="-mt-3">
          {type === "comment" ? (
            <CommentsOptionsMenu postId={postId} commentId={item.id} />
          ) : (
            <FeedbackPostOptionsMenu postId={postId} />
          )}
        </div>
      </div>
    </div>
  );
}
