"use client";

import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";
import { CommentForm } from "@/components/app/comment-form";
import { Comments } from "@/components/app/comments";
import FeedbackPostSidebar from "@/components/app/feedback-post-sidebar";
import { useWindowSize } from "react-use";

export default function FeedbackPostPage() {
  const { width } = useWindowSize();
  const { postId } = useParams<{ postId: string }>();

  return (
    <div className="flex flex-row items-start gap-11">
      <div className="w-full flex-1 space-y-10">
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
      {width >= 800 && <FeedbackPostSidebar postId={postId} />}
    </div>
  );
}
