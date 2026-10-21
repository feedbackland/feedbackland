import { notFound } from "next/navigation";
import { isPostId } from "@/lib/post-id";
import { FeedbackPostPageContent } from "@/components/app/feedback-post/page-content";
export default async function FeedbackPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  if (!isPostId(postId)) notFound();
  return <FeedbackPostPageContent postId={postId} />;
}
