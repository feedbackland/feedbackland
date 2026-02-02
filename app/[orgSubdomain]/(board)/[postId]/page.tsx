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
    <div className="mt-4 flex flex-row items-start gap-11">
      {width >= 768 && <FeedbackPostSidebar postId={postId} />}
      <div className="border-border bg-background w-full min-w-0 flex-1 rounded-lg border shadow-xs">
        <div className="border-border border-b p-5">
          <FeedbackPostFull postId={postId} />
        </div>
        <div className="px-5 pt-5">
          <CommentForm
            postId={postId}
            parentCommentId={null}
            showCloseButton={false}
          />
        </div>
        <div className="p-5">
          <Comments postId={postId} />
        </div>
      </div>
    </div>
  );
}
