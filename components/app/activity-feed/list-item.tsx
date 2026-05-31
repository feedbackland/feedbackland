"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import { CommentsOptionsMenu } from "../comment/options-menu";
import { useSetActivitiesSeen } from "@/hooks/use-set-activities-seen";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import {
  BadgeAlert,
  Check,
  Lightbulb,
  MessageSquare,
  NotebookText,
} from "lucide-react";

function CategoryIcon({ item }: { item: ActivityFeedItem }) {
  const className = "text-muted-foreground mt-0.5 size-4 shrink-0";
  if (item.type === "comment") return <MessageSquare className={className} />;
  if (item.category === "idea") return <Lightbulb className={className} />;
  if (item.category === "issue") return <BadgeAlert className={className} />;
  return <NotebookText className={className} />;
}

export function ActivityFeedListItem({
  item,
  className,
}: {
  item: ActivityFeedItem;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();
  const setActivitySeen = useSetActivitiesSeen();

  const { id, postId, type, status, title, content, createdAt, authorName, isSeen } =
    item;

  const isComment = type === "comment";
  const isUnseen = !isSeen;

  const markSeen = () => setActivitySeen?.mutate({ itemIds: [id] });

  return (
    <div
      className={cn(
        "group/item border-border flex items-start gap-2.5 border-b border-l-2 py-3 pr-2 pl-3 transition-colors last:border-b-0 hover:bg-muted/50",
        isUnseen
          ? "border-l-blue-600 bg-muted/30 dark:border-l-blue-500"
          : "border-l-transparent",
        className,
      )}
    >
      <Link
        href={`${platformUrl}/${postId}`}
        onClick={markSeen}
        className="group/link flex min-w-0 flex-1 items-start gap-2.5"
      >
        <CategoryIcon item={item} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {isComment ? (
            <TiptapOutput
              content={content}
              forbiddenTags={["a", "pre", "img"]}
              className={cn(
                "text-foreground! line-clamp-1 text-sm!",
                isUnseen ? "font-semibold!" : "font-normal!",
              )}
            />
          ) : (
            <h3
              className={cn(
                "truncate text-sm group-hover/link:underline",
                isUnseen ? "font-semibold" : "font-medium",
              )}
            >
              {title}
            </h3>
          )}

          <div className="text-muted-foreground flex items-center gap-1.5 overflow-hidden text-xs">
            {isComment && (
              <>
                <span className="min-w-0 truncate">
                  on <span className="text-foreground/70">"{title}"</span>
                </span>
                <span className="shrink-0 text-[8px]">•</span>
              </>
            )}
            <span className={cn(!isComment && "min-w-0 truncate", isComment && "shrink-0")}>
              {authorName || "Anonymous"}
            </span>
            <span className="shrink-0 text-[8px]">•</span>
            <span className="shrink-0">{timeAgo.format(createdAt, "mini-now")}</span>
            {!isComment && status && (
              <>
                <span className="shrink-0 text-[8px]">•</span>
                <span
                  className={cn(
                    "shrink-0 capitalize",
                    `text-${status.replace(" ", "-")}`,
                  )}
                >
                  {status}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-0.5">
        {isUnseen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mark as read"
                onClick={markSeen}
                className="text-muted-foreground hover:text-primary h-fit w-fit px-1.5 py-1.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
              >
                <Check className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as read</TooltipContent>
          </Tooltip>
        )}
        {isComment ? (
          <CommentsOptionsMenu postId={postId} commentId={id} />
        ) : (
          <FeedbackPostOptionsMenu postId={postId} />
        )}
      </div>
    </div>
  );
}
