"use client";

import { memo, useState } from "react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { CommentUpvoteButton } from "./upvote-button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommentForm } from "../comment-form";

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
  const [showReply, setShowReply] = useState(false);

  const handleReply = () => {
    setShowReply(true);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1">
        <Avatar className="-ml-1 scale-80!">
          <AvatarImage src={authorPhotoURL || undefined} />
          <AvatarFallback>{authorName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
          <div className="text-primary">{authorName}</div>
          <span className="text-[8px]">•</span>
          <div className="">{timeAgo.format(createdAt)}</div>
        </div>
      </div>
      <div className="tiptap-output line-clamp-4">
        {parse(DOMPurify.sanitize(content))}
      </div>
      <div className="-mt-1 flex items-center gap-0.5">
        <CommentUpvoteButton
          commentId={commentId}
          upvoteCount={upvoteCount}
          hasUserUpvote={hasUserUpvote}
          className=""
        />
        <span className="text-[8px]">•</span>
        <Button
          variant="link"
          size="sm"
          onClick={() => handleReply()}
          className=""
        >
          Reply
        </Button>
      </div>
      {showReply && (
        <CommentForm
          postId={postId}
          parentCommentId={commentId}
          onClose={() => setShowReply(false)}
          className="ml-14"
        />
      )}
    </div>
  );
}

export const Comment = memo(Inner);
