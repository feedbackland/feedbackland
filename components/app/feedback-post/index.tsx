"use client";

import { memo } from "react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { UpvoteButton } from "./upvote-button";
import { MessageSquare } from "lucide-react";

function InnerFeedbackPost({
  id,
  title,
  description,
  category,
  createdAt,
  upvoteCount,
  hasUserUpvote,
}: {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: Date;
  upvoteCount: string;
  hasUserUpvote: boolean;
}) {
  return (
    <div className="flex flex-col items-stretch space-y-1">
      <div className="flex justify-between">
        <div className="flex flex-col space-y-0">
          <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            <span className="capitalize">{category}</span>
            <span>•</span>
            <span>{timeAgo.format(createdAt)}</span>
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      </div>

      <div className="text-sm">{parse(DOMPurify.sanitize(description))}</div>

      <div className="flex gap-3.5 pt-1.5">
        <UpvoteButton
          postId={id}
          upvoteCount={upvoteCount}
          hasUserUpvote={hasUserUpvote}
        />
        <Button variant="ghost" size="sm" className="h-fit px-2 py-1.5">
          <MessageSquare className="!size-3" />
          <span className="text-xs">0</span>
        </Button>
      </div>
    </div>
  );
}

export const FeedbackPost = memo(InnerFeedbackPost);
