"use client";

import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { Label } from "@/components/ui/label";
import { UserIcon } from "lucide-react";
import { format } from "date-fns";

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
    const { category, authorName, authorPhotoURL, status, createdAt } = data;

    return (
      <div
        className={cn(
          "border-border sticky top-7 mt-11 flex w-[260px] flex-col items-stretch space-y-6 rounded-md border p-5 shadow-xs",
          className,
        )}
      >
        <div>
          <Label className="text-muted-foreground">Author</Label>
          <div className="flex items-center gap-0.5 text-sm">
            <Avatar className="-ml-1 scale-80!">
              <AvatarImage
                src={authorPhotoURL || undefined}
                alt="User avatar image"
              />
              <AvatarFallback>
                {authorName?.charAt(0) || <UserIcon className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{authorName || "Anonymous"}</span>
          </div>
        </div>
        {createdAt && (
          <div>
            <Label className="text-muted-foreground">Posted on</Label>
            <div className="text-sm">{format(createdAt, "MMM d, yyyy")}</div>
          </div>
        )}
        {category && (
          <div>
            <Label className="text-muted-foreground">Category</Label>
            <div className="text-sm">{capitalizeFirstLetter(category)}</div>
          </div>
        )}
        {status && (
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <div className={`text-sm text-${status?.replace(" ", "-")}`}>
              {capitalizeFirstLetter(status)}
            </div>
          </div>
        )}
      </div>
    );
  }
}
