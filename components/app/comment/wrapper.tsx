"use client";

import { Comment } from "@/components/app/comment";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlusCircleIcon } from "lucide-react";
import { useState } from "react";

export function CommentWrapper({
  comment,
  childComments,
  className,
}: {
  comment: Comment;
  childComments: Comment[];
  className?: React.ComponentProps<"div">["className"];
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div key={comment.id} className={cn("relative", className)}>
      {!isExpanded && (
        <Button
          size="icon"
          variant="outline"
          className="bg-background! absolute! top-0.5 -left-0.5 z-10 size-7.5! rounded-full border-none! shadow-none!"
          onClick={() => setIsExpanded(true)}
        >
          <PlusCircleIcon className="size-4!" />
        </Button>
      )}
      <Comment
        comment={comment}
        childComments={childComments}
        isExpanded={isExpanded}
      />
      <div
        className="group absolute top-10 bottom-2 left-0.5 flex w-[20px] cursor-pointer justify-center"
        onClick={() => setIsExpanded(false)}
      >
        <div className="bg-muted group-hover:bg-primary h-full w-[1px]"></div>
      </div>
    </div>
  );
}
