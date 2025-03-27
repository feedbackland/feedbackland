"use client";

import { cn } from "@/lib/utils";
import { CommentHeader } from "./header";
import { CommentContent } from "./content";
import { CommentFooter } from "./footer";
import { Comment } from "./";

export function CommentInner({
  comment,
  isExpanded = true,
  className,
  onReply,
}: {
  comment: Comment;
  isExpanded?: boolean;
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
      {isExpanded && (
        <div className="pl-8">
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
      )}
    </div>
  );
}
