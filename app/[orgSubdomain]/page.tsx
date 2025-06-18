import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackPosts } from "@/components/app/feedback-posts";

// import dynamic from "next/dynamic";

// const FeedbackForm = dynamic(() =>
//   import("../../components/app/feedback-form").then(
//     ({ FeedbackForm }) => FeedbackForm,
//   ),
// );

export default function OrgPage() {
  return (
    <div>
      <FeedbackForm />
      <FeedbackPosts />
    </div>
  );
}
