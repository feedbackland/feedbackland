"use client";

import { memo } from "react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { CommentUpvoteButton } from "./upvote-button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function Inner({
  postId,
  commentId,
  authorId,
  authorPhotoURL,
  authorName,
  content,
  createdAt,
  upvoteCount,
  hasUserUpvote,
  className,
}: {
  postId: string;
  commentId: string;
  authorId: string;
  authorPhotoURL: string | null;
  authorName: string | null;
  content: string;
  createdAt: Date;
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Avatar>
        <AvatarImage src={authorPhotoURL || undefined} />
        <AvatarFallback>{authorName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-normal">
        <span>{timeAgo.format(createdAt)}</span>
        <span className="text-[8px]">•</span>
        <span className="capitalize">
          posted by {authorName || "unknown author"}
        </span>
      </div>
      <div className="tiptap-output line-clamp-4">
        {parse(DOMPurify.sanitize(content))}
      </div>
      <CommentUpvoteButton
        commentId={commentId}
        upvoteCount={upvoteCount}
        hasUserUpvote={hasUserUpvote}
        className="-mt-1"
      />
    </div>
  );
}

export const Comment = memo(Inner);
