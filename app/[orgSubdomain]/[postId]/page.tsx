"use client";

import "@iframe-resizer/child";
import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";
import { CommentForm } from "@/components/app/comment-form";
import { useState } from "react";

export default function FeedbackPostPage() {
  const params = useParams<{ postId: string }>();
  const [isPostLoaded, setIsPostLoaded] = useState(false);

  return (
    <div className="space-y-10">
      <FeedbackPostFull
        postId={params.postId}
        onLoaded={() => setIsPostLoaded(true)}
      />
      {isPostLoaded && <CommentForm />}
    </div>
  );
}
