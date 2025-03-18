"use client";

import { memo } from "react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { UpvoteButton } from "./upvote-button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

function InnerFeedbackPost({
  id,
  title,
  description,
  category,
  createdAt,
  upvoteCount,
  hasUserUpvote,
  className,
}: {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: Date;
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex flex-col items-stretch space-y-2", className)}>
      <div className="flex justify-between">
        <div className="flex flex-col">
          <div className="text-muted-foreground mb-0.5 flex items-center gap-2 text-xs font-normal">
            <span>{timeAgo.format(createdAt, "twitter-minute-now")}</span>
            <span>•</span>
            <span className="capitalize">{category}</span>
          </div>
          <h3 className="text-[17px] leading-6 font-semibold">{title}</h3>
        </div>
      </div>

      <div className="line-clamp-4 text-sm">
        {parse(DOMPurify.sanitize(description))}
      </div>

      <div className="flex gap-4">
        <UpvoteButton
          postId={id}
          upvoteCount={upvoteCount}
          hasUserUpvote={hasUserUpvote}
        />
        <Button variant="secondary" size="sm" className="h-[26px] px-2 py-1.5">
          <MessageSquare className="size-3!" />
          <span className="text-xs">0</span>
        </Button>
      </div>
    </div>
  );
}

export const FeedbackPost = memo(InnerFeedbackPost);
