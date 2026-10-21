"use client";

import { cn } from "@/lib/utils";
import { CommentHeader } from "./header";
import { CommentFooter } from "./footer";
import { Comment } from "./";
import { CommentsOptionsMenu } from "./options-menu";
import { useState } from "react";
import { CommentEdit } from "./edit";
import { TiptapOutput } from "@/components/ui/tiptap-output";

export type CommentReplyMeta = {
  commentId: string;
  parentCommentId: string | null;
  authorId: string | null;
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
    revision,
    createdAt,
    upvotes,
    authorId,
    authorName,
    authorRole,
    authorImage,
    hasUserUpvote,
  } = comment;

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between">
        <CommentHeader
          authorName={authorName}
          authorRole={authorRole}
          authorImage={authorImage}
          createdAt={createdAt}
          isExpanded={isExpanded}
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
        <div className="pl-9">
          {!isEditing ? (
            <>
              <TiptapOutput key={id} content={content} />
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
              expectedRevision={revision}
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
