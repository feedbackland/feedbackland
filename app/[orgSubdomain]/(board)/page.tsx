import { FeedbackForm } from "@/components/app/feedback-form";
import { FeedbackPosts } from "@/components/app/feedback-posts";
import FeedbackPostsSidebar from "@/components/app/feedback-posts-sidebar";

export default function OrgPage() {
  return (
    <div className="flex flex-1 flex-row items-start gap-11">
      <div className="flex-1 space-y-7">
        <FeedbackForm />
        <FeedbackPosts />
      </div>
      <FeedbackPostsSidebar />
    </div>
  );
}
