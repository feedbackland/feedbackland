"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const CommentsButton = ({
  commentCount,
  onClick,
  className,
}: {
  commentCount: string;
  onClick?: () => void;
  className?: React.ComponentProps<"div">["className"];
}) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn(
        "flex h-[25px] items-center px-2 py-0 [&>span]:gap-1.5",
        className,
      )}
      onClick={() => {
        onClick?.();
      }}
    >
      <MessageSquare className="size-3!" />
      <span className="text-xs">{commentCount}</span>
    </Button>
  );
};
