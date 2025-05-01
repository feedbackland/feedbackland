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

function Inner({
  postId,
  title,
  description,
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
  createdAt: Date;
  category: string | null;
  upvoteCount: string;
  commentCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();

  return (
    <div className="group relative">
      <Link
        href={`${platformUrl}/${postId}`}
        // className="group-hover:border-primary/40 border-border flex flex-col items-stretch space-y-2 rounded-lg border p-3.5 pb-12"
        className="group-hover:border-primary/40 border-border flex flex-col items-stretch space-y-2 pb-8"
      >
        <>
          <div
            className={cn("flex flex-col items-stretch space-y-1.5", className)}
          >
            <div className="flex flex-col items-stretch">
              {/* <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-normal">
                <span>{timeAgo.format(createdAt)}</span>
                <span className="text-[8px]">•</span>
                <span className="capitalize">{category}</span>
              </div> */}
              <h3 className="text-[16px] leading-5.5 font-semibold group-hover:underline">
                {title}
              </h3>
            </div>

            <TiptapOutput
              content={description}
              forbiddenTags={["a", "pre", "img"]}
              className="text-primary/70! mt-[-1] line-clamp-4"
            />
          </div>
        </>
      </Link>
      <div className="absolute bottom-0 left-0 z-10 flex items-center gap-2.5">
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
          className="flex h-[24px] items-center px-1.5 py-0 [&>span]:gap-1"
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
