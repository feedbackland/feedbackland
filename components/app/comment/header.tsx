"use client";

import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function CommentHeader({
  authorPhotoURL,
  authorName,
  createdAt,
  className,
}: {
  authorPhotoURL: string | null;
  authorName: string | null;
  createdAt: Date;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Avatar className="-ml-1 scale-80!">
        <AvatarImage src={authorPhotoURL || undefined} />
        <AvatarFallback>{authorName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
        <div className="text-primary">{authorName}</div>
        <span className="text-[8px]">•</span>
        <div className="">{timeAgo.format(createdAt)}</div>
      </div>
    </div>
  );
}
