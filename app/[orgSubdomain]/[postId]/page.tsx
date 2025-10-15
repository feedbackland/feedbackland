"use client";

import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";
import { CommentForm } from "@/components/app/comment-form";
import { Comments } from "@/components/app/comments";

export default function FeedbackPostPage() {
  const { postId } = useParams<{ postId: string }>();

  return (
    <div className="space-y-10">
      <FeedbackPostFull postId={postId} />
      <div className="space-y-10">
        <CommentForm
          postId={postId}
          parentCommentId={null}
          showCloseButton={false}
        />
        <Comments postId={postId} />
      </div>
    </div>
  );
}
