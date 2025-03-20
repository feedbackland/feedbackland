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
      <Link href={`${platformUrl}/${postId}`}>
        <div
          className={cn(
            "bg-background border-border group-hover:border-muted-foreground flex flex-col items-stretch space-y-2 rounded-md border p-3.5 pb-13",
            className,
          )}
        >
          <div className="flex justify-between">
            <div className="flex flex-col">
              <div className="text-muted-foreground mb-0.5 flex items-center gap-1.5 text-xs font-normal">
                <span>{timeAgo.format(createdAt)}</span>
                <span className="text-[8px]">•</span>
                <span className="capitalize">{category}</span>
              </div>
              <h3 className="text-[16px] leading-5.5 font-semibold">{title}</h3>
            </div>
          </div>

          <div className="tiptap-output line-clamp-4">
            {parse(DOMPurify.sanitize(description))}
          </div>
        </div>
      </Link>
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        <FeedbackPostUpvoteButton
          postId={postId}
          upvoteCount={upvoteCount}
          hasUserUpvote={hasUserUpvote}
          className="h-[25px] px-2 py-1 [&>span]:gap-1"
        />
        <Button variant="secondary" size="sm" className="h-[25px] px-2 py-1.5">
          <MessageSquare className="size-3!" />
          <span className="text-xs">0</span>
        </Button>
      </div>
    </div>
  );
}

export const FeedbackPostCompact = memo(Inner);
