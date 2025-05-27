"use client";

import { CommentUpvoteButton } from "./upvote-button";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function CommentFooter({
  commentId,
  upvotes,
  hasUserUpvote,
  className,
  onReplyClicked,
}: {
  commentId: string;
  upvotes: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
  onReplyClicked: () => void;
}) {
  return (
    <div className={cn("mt-0.5 flex items-center gap-0", className)}>
      <CommentUpvoteButton
        commentId={commentId}
        upvoteCount={upvotes}
        hasUserUpvote={hasUserUpvote}
        className="text-xs"
      />
      <span className="text-muted-foreground text-[8px]">•</span>
      <Button
        variant="link"
        size="sm"
        onClick={onReplyClicked}
        className="text-muted-foreground hover:text-primary text-xs"
      >
        Reply
      </Button>
    </div>
  );
}
