"use client";

import { cn } from "@/lib/utils";
import { CommentHeader } from "./header";
import { CommentContent } from "./content";
import { CommentFooter } from "./footer";
import { Comment } from "./";
import { CommentsOptionsMenu } from "./options-menu";
import { useState } from "react";
import { CommentEdit } from "./edit";

export type CommentReplyMeta = {
  commentId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string | null;
};

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
    authorId,
    authorName,
  }: CommentReplyMeta) => void;
}) {
  const {
    id,
    parentCommentId,
    postId,
    content,
    createdAt,
    upvotes,
    authorId,
    authorName,
    authorPhotoURL,
    hasUserUpvote,
  } = comment;

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between">
        <CommentHeader
          authorName={authorName}
          authorPhotoURL={authorPhotoURL}
          createdAt={createdAt}
        />
        <CommentsOptionsMenu
          postId={postId}
          commentId={id}
          authorId={authorId}
          onEdit={() => {
            setIsEditing(true);
          }}
        />
      </div>
      {isExpanded && (
        <div className="pl-8">
          {!isEditing ? (
            <>
              <CommentContent content={content} key={id} />
              <CommentFooter
                commentId={id}
                upvotes={upvotes}
                hasUserUpvote={hasUserUpvote}
                onReplyClicked={() => {
                  onReply({
                    commentId: id,
                    parentCommentId,
                    authorId: comment.authorId,
                    authorName: comment.authorName,
                  });
                }}
              />
            </>
          ) : (
            <CommentEdit
              postId={postId}
              commentId={id}
              content={content}
              onClose={() => {
                setIsEditing(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
