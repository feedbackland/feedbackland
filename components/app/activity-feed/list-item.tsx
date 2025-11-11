"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import Link from "next/link";
import { CommentsOptionsMenu } from "../comment/options-menu";
import { useSetActivitiesSeen } from "@/hooks/use-set-activities-seen";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { BugIcon, Inbox, Lightbulb, MessageSquare } from "lucide-react";

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
        "border-border flex flex-1 items-center gap-6 border-b-1 py-4 pr-2 pl-3",
        className,
      )}
    >
      <div className="flex flex-1 items-stretch gap-2">
        <div className="border-border flex items-center justify-center rounded-md border px-3 shadow-xs">
          {item.type === "comment" && <MessageSquare className="size-4!" />}

          {item.type !== "comment" && category === "idea" && (
            <Lightbulb className="size-4!" />
          )}

          {item.type !== "comment" && category === "general feedback" && (
            <Inbox className="size-4!" />
          )}

          {item.type !== "comment" && category === "issue" && (
            <BugIcon className="size-4!" />
          )}
        </div>

        <Link
          key={item.id}
          href={`${platformUrl}/${item.postId}`}
          onClick={() => handleOnClick(item.id)}
          className="group flex flex-1 flex-col items-stretch hover:cursor-pointer"
        >
          <div className="text-muted-foreground mb-0.5 flex flex-wrap items-center gap-1 text-xs font-normal">
            <span className="capitalize">
              {capitalizeFirstLetter(
                type === "comment" ? type : category || "",
              )}
            </span>
            <span className="text-[8px]">•</span>
            <span>{timeAgo.format(createdAt, "mini-now")} ago</span>
            {status && (
              <>
                <span className="text-[8px]">•</span>
                <span
                  className={cn(
                    "capitalize",
                    `text-${status.replace(" ", "-")}`,
                  )}
                >
                  {status}
                </span>
              </>
            )}
          </div>

          <h3
            className={cn(
              "mb-2 flex items-center gap-2.5 text-sm font-semibold group-hover:underline",
            )}
          >
            <span>{title}</span>
            {!item.isSeen && (
              <span className="size-2 rounded-full bg-blue-600 dark:bg-blue-500" />
            )}
          </h3>

          <TiptapOutput
            content={content}
            forbiddenTags={["a", "pre", "img"]}
            className={cn(
              "text-muted-foreground! line-clamp-4 text-sm!",
              !item.isSeen && "font-semibold!",
            )}
          />
        </Link>

        <div className="-mt-2">
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
