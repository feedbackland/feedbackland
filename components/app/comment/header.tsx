"use client";

import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserIcon } from "lucide-react";

export function CommentHeader({
  authorPhotoURL,
  authorName,
  authorRole,
  createdAt,
  className,
}: {
  authorPhotoURL: string | null;
  authorName: string | null;
  authorRole: "user" | "admin" | null;
  createdAt: Date;
  className?: React.ComponentProps<"div">["className"];
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className="size-7">
        <AvatarImage
          src={authorPhotoURL || undefined}
          alt="User avatar image"
        />
        <AvatarFallback>
          {authorName?.charAt(0) || <UserIcon className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
        <div className="font-medium text-foreground">
          {authorName}
          {authorRole === "admin" && (
            <Badge variant="outline" className="border-primary/30 ml-1 text-[10px] px-1 py-0 font-normal">
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
