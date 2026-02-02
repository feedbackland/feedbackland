"use client";

import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { Label } from "@/components/ui/label";
import { UserIcon } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { Skeleton } from "@/components/ui/skeleton";

export default function FeedbackPostSidebar({
  postId,
  className,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const {
    query: { data, isPending },
  } = useFeedbackPost({ postId });

  if (isPending) {
    return (
      <div
        className={cn(
          "border-border bg-background sticky top-7 mt-1 flex w-[280px] shrink-0 flex-col items-stretch rounded-lg border p-5 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    );
  }

  if (data) {
    const { category, authorName, authorPhotoURL, status, createdAt } = data;

    return (
      <div
        className={cn(
          "border-border bg-background sticky top-7 mt-1 flex w-[280px] shrink-0 flex-col items-stretch rounded-lg border p-5 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarImage
              src={authorPhotoURL || undefined}
              alt="User avatar image"
            />
            <AvatarFallback>
              {authorName?.charAt(0) || <UserIcon className="size-4" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{authorName || "Anonymous"}</span>
            <span className="text-muted-foreground text-xs">Author</span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-3.5">
          {createdAt && (
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs">Posted on</Label>
              <span className="text-xs">{format(createdAt, "MMM d, yyyy")}</span>
            </div>
          )}
          {category && (
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs">Category</Label>
              <Badge variant="secondary" className="capitalize text-xs">
                {capitalizeFirstLetter(category)}
              </Badge>
            </div>
          )}
          {status && (
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Badge
                variant="secondary"
                className={cn("capitalize text-xs", `text-${status?.replace(" ", "-")}`)}
              >
                {capitalizeFirstLetter(status)}
              </Badge>
            </div>
          )}
        </div>
      </div>
    );
  }
}
