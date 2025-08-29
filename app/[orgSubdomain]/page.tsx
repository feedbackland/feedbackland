import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackPosts } from "@/components/app/feedback-posts";

export default function OrgPage() {
  return (
    <div className="space-y-7">
      <FeedbackForm />
      <FeedbackPosts />
    </div>
  );
}
