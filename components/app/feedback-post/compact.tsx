"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackPostUpvoteButton } from "./upvote-button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { timeAgo } from "@/lib/time-ago";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import Link from "next/link";

function Inner({
  postId,
  title,
  description,
  createdAt,
  category,
  upvoteCount,
  hasUserUpvote,
  className,
}: {
  postId: string;
  title: string;
  description: string;
  createdAt: Date;
  category: string | null;
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();

  return (
    <div className="group relative">
      <Link
        href={`${platformUrl}/${postId}`}
        className="group-hover:border-primary/40 flex flex-col items-stretch space-y-2 rounded-lg border p-3.5 pb-12"
      >
        <>
          <div
            className={cn("flex flex-col items-stretch space-y-1.5", className)}
          >
            <div className="flex flex-col items-stretch">
              <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-normal">
                <span>{timeAgo.format(createdAt)}</span>
                <span className="text-[8px]">•</span>
                <span className="capitalize">{category}</span>
              </div>
              <h3 className="text-[17px] leading-5.5 font-semibold">{title}</h3>
            </div>

            <div className="tiptap-output mt-[-1] line-clamp-4">
              {parse(DOMPurify.sanitize(description))}
            </div>
          </div>
        </>
      </Link>
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2.5">
        <FeedbackPostUpvoteButton
          postId={postId}
          variant="secondary"
          upvoteCount={upvoteCount}
          hasUserUpvote={hasUserUpvote}
          className="flex h-[25px] items-center px-2 py-0 [&>span]:gap-1"
        />
        <Button
          variant="secondary"
          size="sm"
          className="flex h-[25px] items-center px-2 py-0 [&>span]:gap-1"
          asChild
        >
          <Link
            href={`${platformUrl}/${postId}`}
            className="flex items-center gap-1"
          >
            <MessageSquare className="size-3!" />
            <span className="text-xs">0</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export const FeedbackPostCompact = memo(Inner);
