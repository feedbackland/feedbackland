"use client";

import { cn } from "@/lib/utils";
import { CommentHeader } from "./header";
import { CommentContent } from "./content";
import { CommentFooter } from "./footer";
import { Comment } from "./";

export function CommentInner({
  comment,
  className,
  onReply,
}: {
  comment: Comment;
  className?: React.ComponentProps<"div">["className"];
  onReply: ({
    commentId,
    parentCommentId,
  }: {
    commentId: string;
    parentCommentId: string | null;
  }) => void;
}) {
  const {
    id,
    parentCommentId,
    content,
    createdAt,
    upvotes,
    authorName,
    authorPhotoURL,
    hasUserUpvote,
  } = comment;

  return (
    <div className={cn("", className)}>
      <CommentHeader
        authorName={authorName}
        authorPhotoURL={authorPhotoURL}
        createdAt={createdAt}
      />
      <CommentContent content={content} key={id} />
      <CommentFooter
        commentId={id}
        upvotes={upvotes}
        hasUserUpvote={hasUserUpvote}
        onReplyClicked={() => {
          onReply({ commentId: id, parentCommentId });
        }}
      />
    </div>
  );
}
