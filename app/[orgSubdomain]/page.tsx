// import { FeedbackForm } from "@/components/app/feedback-form";
// import { FeedbackPosts } from "@/components/app/feedback-posts";

import { FeedbackFormLoading } from "@/components/app/feedback-form/loading";
import dynamic from "next/dynamic";

const FeedbackForm = dynamic(
  () =>
    import("../../components/app/feedback-form").then(
      ({ FeedbackForm }) => FeedbackForm,
    ),
  { ssr: true, loading: () => <FeedbackFormLoading /> },
);

const FeedbackPosts = dynamic(
  () =>
    import("../../components/app/feedback-posts").then(
      ({ FeedbackPosts }) => FeedbackPosts,
    ),
  { ssr: true },
);

export default function OrgPage() {
  return (
    <>
      <FeedbackForm />
      <FeedbackPosts />
    </>
  );
}
