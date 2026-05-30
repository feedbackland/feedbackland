"use client";

import { ActivityFeedItem } from "@/lib/typings";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import { CommentsOptionsMenu } from "../comment/options-menu";
import { useSetActivitiesSeen } from "@/hooks/use-set-activities-seen";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import {
  ArrowBigUp,
  BadgeAlert,
  Check,
  Lightbulb,
  MessageSquare,
  NotebookText,
  UserIcon,
} from "lucide-react";

function CategoryIcon({ item }: { item: ActivityFeedItem }) {
  const className = "size-4";
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

  const {
    id,
    postId,
    type,
    category,
    status,
    title,
    content,
    createdAt,
    upvotes,
    commentCount,
    authorName,
    authorPhotoURL,
    isSeen,
  } = item;

  const isComment = type === "comment";
  const isUnseen = !isSeen;

  const markSeen = () => setActivitySeen?.mutate({ itemIds: [id] });

  return (
    <div
      className={cn(
        "group/item border-border relative flex items-start gap-3 border-b border-l-2 py-4 pr-2 pl-3 transition-colors",
        isUnseen ? "border-l-blue-600 bg-muted/30 dark:border-l-blue-500" : "border-l-transparent",
        className,
      )}
    >
      <div className="text-muted-foreground border-border bg-background mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border">
        <CategoryIcon item={item} />
      </div>

      <Link
        href={`${platformUrl}/${postId}`}
        onClick={markSeen}
        className="group/link flex min-w-0 flex-1 flex-col items-stretch"
      >
        <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
          {isComment ? (
            <span className="truncate">
              Comment · <span className="text-foreground/80">"{title}"</span>
            </span>
          ) : (
            <span className="capitalize">
              {capitalizeFirstLetter(category || "")}
            </span>
          )}
          {!isComment && status && (
            <>
              <span className="text-[8px]">•</span>
              <span
                className={cn("capitalize", `text-${status.replace(" ", "-")}`)}
              >
                {status}
              </span>
            </>
          )}
        </div>

        {!isComment && (
          <h3
            className={cn(
              "mt-0.5 text-sm group-hover/link:underline",
              isUnseen ? "font-semibold" : "font-medium",
            )}
          >
            {title}
          </h3>
        )}

        <TiptapOutput
          content={content}
          forbiddenTags={["a", "pre", "img"]}
          className={cn(
            "text-muted-foreground! mt-1 line-clamp-1 text-sm! sm:line-clamp-2",
            isComment && isUnseen && "text-foreground! font-medium!",
          )}
        />

        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <Avatar className="size-4">
              <AvatarImage src={authorPhotoURL || undefined} alt="" />
              <AvatarFallback className="text-[9px]">
                {authorName?.charAt(0) || <UserIcon className="size-2.5" />}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground/80 font-medium">
              {authorName || "Anonymous"}
            </span>
          </span>
          <span className="text-[8px]">•</span>
          <span>{timeAgo.format(createdAt, "mini-now")} ago</span>
          <span className="text-[8px]">•</span>
          <span className="flex items-center gap-0.5">
            <ArrowBigUp className="size-3.5" />
            {upvotes}
          </span>
          {!isComment && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="size-3" />
              {commentCount ?? 0}
            </span>
          )}
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
                className="text-muted-foreground hover:text-primary size-7 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
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
