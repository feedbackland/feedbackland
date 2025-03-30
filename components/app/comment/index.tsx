"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { CommentForm } from "../comment-form";
import { CommentInner } from "./inner";
import { type CommentReplyMeta } from "./inner";

export interface Comment {
  id: string;
  parentCommentId: string | null;
  postId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  upvotes: string;
  authorName: string | null;
  authorPhotoURL: string | null;
  hasUserUpvote: boolean;
}

export const Comment = memo(function Comment({
  comment,
  childComments,
  isExpanded = true,
  className,
}: {
  comment: Comment;
  childComments: Comment[];
  isExpanded?: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyMeta, setReplyMeta] = useState<CommentReplyMeta | null>(null);

  const handleReply = (replyMeta: CommentReplyMeta) => {
    setShowReply(true);
    setReplyMeta(replyMeta);
  };

  return (
    <div className={cn("", className)}>
      <CommentInner
        key={comment.id}
        comment={comment}
        onReply={handleReply}
        isExpanded={isExpanded}
      />
      {isExpanded && childComments?.length > 0 && (
        <div className="mt-3 ml-8 space-y-4">
          {childComments
            .sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateA - dateB;
            })
            .map((childComment) => (
              <CommentInner
                key={childComment.id}
                comment={childComment}
                onReply={handleReply}
                className=""
              />
            ))}
        </div>
      )}
      {isExpanded && showReply && replyMeta && (
        <CommentForm
          postId={comment.postId}
          parentCommentId={comment.id}
          replyToAuthorId={replyMeta.authorId}
          replyToAuthorName={replyMeta.authorName}
          scrollIntoView={true}
          className="mt-1 ml-8"
          onClose={() => {
            setShowReply(false);
            setReplyMeta(null);
          }}
        />
      )}
    </div>
  );
});
