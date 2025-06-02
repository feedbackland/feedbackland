"use client";

// import { FeedbackForm } from "@/components/app/feedback-form";
// import { FeedbackPosts } from "@/components/app/feedback-posts";
import dynamic from "next/dynamic";

const FeedbackForm = dynamic(
  () =>
    import("../../components/app/feedback-form").then(
      ({ FeedbackForm }) => FeedbackForm,
    ),
  { ssr: false },
);

const FeedbackPosts = dynamic(
  () =>
    import("../../components/app/feedback-posts").then(
      ({ FeedbackPosts }) => FeedbackPosts,
    ),
  { ssr: false },
);

export default function OrgPage() {
  return (
    <>
      <FeedbackForm />
      <FeedbackPosts />
    </>
  );
}
