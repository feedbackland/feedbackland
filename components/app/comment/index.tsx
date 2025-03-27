"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { CommentForm } from "../comment-form";
import { CommentInner } from "./inner";

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
  const [replyParentCommentId, setReplyParentCommentId] = useState<
    string | null
  >(null);

  const handleReply = ({
    commentId,
    parentCommentId,
  }: {
    commentId: string;
    parentCommentId: string | null;
  }) => {
    setShowReply(true);
    setReplyParentCommentId(parentCommentId);
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
        <div className="mt-3 ml-8 space-y-3">
          {childComments.map((childComment) => (
            <CommentInner
              key={childComment.id}
              comment={childComment}
              onReply={handleReply}
              className=""
            />
          ))}
        </div>
      )}
      {isExpanded && showReply && (
        <CommentForm
          postId={comment.postId}
          parentCommentId={replyParentCommentId}
          onClose={() => {
            setShowReply(false);
            setReplyParentCommentId(null);
          }}
          className="mt-1 ml-12"
        />
      )}
    </div>
  );
});
