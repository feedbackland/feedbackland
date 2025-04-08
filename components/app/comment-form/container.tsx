"use client";

// import { useState } from "react";
// import { CommentFormBanner } from "@/components/app/comment-form/banner";
import { CommentForm } from "@/components/app/comment-form";

export function CommentFormContainer({
  postId,
  parentCommentId,
}: {
  postId: string;
  parentCommentId: string | null;
}) {
  return <CommentForm postId={postId} parentCommentId={parentCommentId} />;

  // const [isFormOpen, setIsFormOpen] = useState(false);

  // return (
  //   <>
  //     {!isFormOpen ? (
  //       <CommentFormBanner onClick={() => setIsFormOpen(true)} />
  //     ) : (
  //       <CommentForm
  //         postId={postId}
  //         parentCommentId={parentCommentId}
  //         onClose={() => setIsFormOpen(false)}
  //         onSuccess={() => setIsFormOpen(false)}
  //       />
  //     )}
  //   </>
  // );
}
