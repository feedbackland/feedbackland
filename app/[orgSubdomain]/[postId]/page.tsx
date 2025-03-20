"use client";

import "@iframe-resizer/child";
import { useParams } from "next/navigation";
import { FeedbackPostFull } from "@/components/app/feedback-post/full";

export default function FeedbackPostPage() {
  const params = useParams<{ postId: string }>();
  return <FeedbackPostFull postId={params.postId} />;
}
