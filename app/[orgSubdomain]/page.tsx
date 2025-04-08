"use client";

import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackPosts } from "@/components/app/feedback-posts";

export default function OrgPage() {
  return (
    <>
      <FeedbackForm />
      <FeedbackPosts />
    </>
  );
}
