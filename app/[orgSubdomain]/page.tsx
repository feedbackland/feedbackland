"use client";

import "@iframe-resizer/child";
import { FeedbackFormContainer } from "@/components/app/feedback-form/container";
import { FeedbackPostsList } from "@/components/app/feedback-posts/list";

export default function OrgPage() {
  return (
    <div className="">
      <FeedbackFormContainer />
      <FeedbackPostsList />
    </div>
  );
}
