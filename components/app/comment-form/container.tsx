"use client";

import { useState } from "react";
import { CommentForm } from "@/components/app/comment-form";
import { CommentFormBanner } from "@/components/app/comment-form/banner";

export function CommentFormContainer({
  postId,
  parentCommentId,
}: {
  postId: string;
  parentCommentId?: string;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      {!isFormOpen ? (
        <CommentFormBanner onClick={() => setIsFormOpen(true)} />
      ) : (
        <CommentForm
          postId={postId}
          parentCommentId={parentCommentId}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => setIsFormOpen(false)}
        />
      )}
    </>
  );
}
