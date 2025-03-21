"use client";

import { memo } from "react";

function Inner({
  postId,
  title,
  description,
  createdAt,
  category,
  upvoteCount,
  hasUserUpvote,
  className,
}: {
  postId: string;
  title: string;
  description: string;
  createdAt: Date;
  category: string | null;
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className="">
      <div className="tiptap-output line-clamp-4">
        {/* {parse(DOMPurify.sanitize(description))} */}
        This is a comment
      </div>
    </div>
  );
}

export const Comment = memo(Inner);
