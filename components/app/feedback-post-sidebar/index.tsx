"use client";

import { cn } from "@/lib/utils";
import { UpvoteButton } from "@/components/app/upvote-button";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { Label } from "@/components/ui/label";

export default function FeedbackPostSidebar({
  postId,
  className,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data },
  } = useFeedbackPost({ postId });

  if (data) {
    const { category, upvotes, hasUserUpvote, authorName, status } = data;

    return (
      <div
        className={cn(
          "border-border flex h-[600px] w-[260px] flex-col items-stretch space-y-6 rounded-md border p-5 shadow-xs",
          className,
        )}
      >
        <div>
          <UpvoteButton
            postId={postId}
            upvoteCount={upvotes}
            hasUserUpvote={hasUserUpvote}
          />
        </div>
        <div>
          <Label>Posted by</Label>
          <div>{authorName || "Anonymous user"}</div>
        </div>
        {category && (
          <div>
            <Label>Category</Label>
            <div>{category}</div>
          </div>
        )}
        {status && (
          <div>
            <Label>Status</Label>
            <div className={`text-${status?.replace(" ", "-")}`}>{status}</div>
          </div>
        )}
      </div>
    );
  }
}
