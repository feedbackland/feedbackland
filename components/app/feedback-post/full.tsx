"use client";

import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { FeedbackPostUpvoteButton } from "./upvote-button";
import { MessageSquare, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { GoBackButton } from "./go-back-button";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackPostOptionsMenu } from "./options-menu";
import { FeedbackPostEdit } from "./edit";
import { TiptapOutput } from "@/components/ui/tiptap-output";

export function FeedbackPostFull({
  postId,
  className,
  onLoaded,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
  onLoaded?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const {
    query: { data },
  } = useFeedbackPost({ postId });

  useEffect(() => {
    if (data) {
      onLoaded?.();
    }
  }, [data, onLoaded]);

  if (data) {
    const {
      title,
      description,
      createdAt,
      category,
      upvotes,
      hasUserUpvote,
      authorName,
      authorPhotoURL,
      commentCount,
      status,
    } = data;

    return (
      <div className="mt-3">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <GoBackButton className="" />
            <Avatar className="">
              <AvatarImage src={authorPhotoURL || undefined} />
              <AvatarFallback>
                {authorName?.charAt(0) || <UserIcon className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0">
              <div className="text-primary text-xs font-normal">
                {authorName}
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-normal">
                <span>{timeAgo.format(createdAt)}</span>
                <span className="text-[8px]">•</span>
                <span className="capitalize">{category}</span>
                {status && (
                  <>
                    <span className="text-[8px]">•</span>
                    <span
                      className={cn(
                        "capitalize",
                        `text-${status.replace(" ", "-")}`,
                      )}
                    >
                      {status}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div>
            <FeedbackPostOptionsMenu
              postId={postId}
              authorId={data.authorId}
              onEdit={() => setIsEditing(true)}
            />
          </div>
        </div>

        {isEditing ? (
          <FeedbackPostEdit
            postId={postId}
            title={title}
            description={description}
            onClose={() => setIsEditing(false)}
          />
        ) : (
          <div
            className={cn("flex flex-col items-stretch space-y-3", className)}
          >
            <h2 className="text-xl font-semibold">{title}</h2>

            <TiptapOutput content={description} />

            <div className="flex items-center gap-2.5 pt-2">
              <FeedbackPostUpvoteButton
                postId={postId}
                variant="secondary"
                upvoteCount={upvotes}
                hasUserUpvote={hasUserUpvote}
                className="flex h-[25px] items-center px-2 py-0 [&>span]:gap-1"
              />
              <Button
                variant="secondary"
                size="sm"
                className="flex h-[25px] items-center px-2 py-0 [&>span]:gap-1"
              >
                <MessageSquare className="size-3!" />
                <span className="text-xs">{commentCount}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
