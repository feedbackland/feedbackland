"use client";

import "@iframe-resizer/child";
import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";
import { CommentFormContainer } from "@/components/app/comment-form/container";
import { useState } from "react";
import { Comments } from "@/components/app/comments";

export default function FeedbackPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const [isPostLoaded, setIsPostLoaded] = useState(false);

  return (
    <div className="space-y-10">
      <FeedbackPostFull
        postId={postId}
        onLoaded={() => setIsPostLoaded(true)}
      />
      {isPostLoaded && (
        <div className="space-y-10">
          <CommentFormContainer postId={postId} />
          <Comments postId={postId} />
        </div>
      )}
    </div>
  );
}
