"use client";

import { FeedbackFormContainer } from "@/components/app/feedback-form/container";
import { FeedbackPosts } from "@/components/app/feedback-posts";

export default function OrgPage() {
  return (
    <>
      <div className="">
        <FeedbackFormContainer />
        <FeedbackPosts />
      </div>
    </>
  );
}
