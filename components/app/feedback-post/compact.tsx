"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackPostUpvoteButton } from "./upvote-button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import Link from "next/link";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { FeedbackStatus } from "@/lib/typings";

function Inner({
  postId,
  title,
  description,
  status,
  createdAt,
  category,
  upvoteCount,
  commentCount,
  hasUserUpvote,
  className,
}: {
  postId: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  createdAt: Date;
  category: string | null;
  upvoteCount: string;
  commentCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();

  return (
    <div className={cn("", className)} data-post-id={postId}>
      <Link
        href={`${platformUrl}/${postId}`}
        className="group flex flex-col items-stretch space-y-1.5"
      >
        <div className="flex flex-col items-stretch">
          <h2 className="mb-0.5 text-[17px] leading-5.5 font-semibold group-hover:underline">
            {title}
          </h2>

          <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-normal">
            <span>{timeAgo.format(createdAt, "mini")}</span>
            <span className="text-[8px]">•</span>
            <span className="capitalize">{category}</span>
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
        </div>

        <TiptapOutput
          content={description}
          forbiddenTags={["a", "pre", "img"]}
          className="text-primary/70! mt-[-1] line-clamp-4"
        />
      </Link>

      <div className="mt-2 flex items-center gap-2.5">
        <FeedbackPostUpvoteButton
          postId={postId}
          variant="secondary"
          upvoteCount={upvoteCount}
          hasUserUpvote={hasUserUpvote}
          className="flex h-[24px] items-center px-1.5 py-0 [&>span]:gap-1"
        />
        <Button
          variant="secondary"
          size="sm"
          className="flex h-[24px] items-center px-2 py-0 [&>span]:gap-1"
          asChild
        >
          <Link
            href={`${platformUrl}/${postId}`}
            className="flex items-center gap-1"
          >
            <MessageSquare className="size-3!" />
            <span className="text-xs">{commentCount}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export const FeedbackPostCompact = memo(Inner);
