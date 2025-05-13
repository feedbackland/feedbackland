"use client";

import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

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
  const { session } = useAuth();
  const isAdmin = session?.userOrg?.role === "admin";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Avatar className="-ml-1 scale-80!">
        <AvatarImage src={authorPhotoURL || undefined} />
        <AvatarFallback>{authorName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
        <div className="text-primary">
          {authorName}
          {isAdmin && (
            <Badge variant="outline" className="border-primary ml-1 scale-85">
              Admin
            </Badge>
          )}
        </div>
        <span className="text-[8px]">•</span>
        <div className="">{timeAgo.format(createdAt)}</div>
      </div>
    </div>
  );
}
