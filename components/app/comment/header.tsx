"use client";

import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserIcon } from "lucide-react";

export function CommentHeader({
  authorImage,
  authorName,
  authorRole,
  createdAt,
  isExpanded = true,
  className,
}: {
  authorImage: string | null;
  authorName: string | null;
  authorRole: "user" | "admin" | null;
  createdAt: Date;
  isExpanded?: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className={cn("size-7", !isExpanded && "invisible")}>
        <AvatarImage src={authorImage || undefined} alt="User avatar image" />
        <AvatarFallback>
          {authorName?.charAt(0) || <UserIcon className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
        <div className="text-foreground font-medium">
          {authorName ?? "Deleted user"}
          {authorRole === "admin" && (
            <Badge
              variant="outline"
              className="border-primary/30 ml-1 px-1 py-0 text-[10px] font-normal"
            >
              Admin
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground/50">·</span>
        <div>{timeAgo.format(createdAt, "mini-now")}</div>
      </div>
    </div>
  );
}
