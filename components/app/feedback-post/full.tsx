"use client";

import { timeAgo } from "@/lib/time-ago";
import { UpvoteButton } from "@/components/app/upvote-button";
import { CommentsButton } from "@/components/app/comments-button.tsx";
import { cn } from "@/lib/utils";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { GoBackButton } from "./go-back-button";
import { useEffect, useState } from "react";
import { FeedbackPostOptionsMenu } from "./options-menu";
import { FeedbackPostEdit } from "./edit";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { useWindowSize } from "react-use";

import { Skeleton } from "@/components/ui/skeleton";

export function FeedbackPostFull({
  postId,
  className,
  onLoaded,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
  onLoaded?: () => void;
}) {
  const { width } = useWindowSize();

  const [isEditing, setIsEditing] = useState(false);

  const {
    query: { data, isPending },
  } = useFeedbackPost({ postId });

  useEffect(() => {
    if (data) {
      onLoaded?.();
    }
  }, [data, onLoaded]);

  if (isPending) {
    return (
      <div className={cn("mt-2 flex flex-col space-y-3", className)}>
        <div className="mb-2.5 flex items-start justify-between">
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-col items-stretch gap-2">
          <div className="flex items-center justify-between gap-3.5">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="size-8 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="space-y-2 py-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex items-center gap-2.5 pt-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    );
  }

  if (data) {
    const {
      title,
      description,
      createdAt,
      category,
      upvotes,
      hasUserUpvote,
      authorName,
      commentCount,
      status,
    } = data;

    return (
      <div className="mt-2">
        <div className="mb-2.5 flex items-start justify-between">
          <GoBackButton />
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
            <div className="flex flex-col items-stretch gap-0.5">
              <div className="flex items-center justify-between gap-3.5">
                <h2 className="text-xl font-semibold">{title}</h2>
                <div className="">
                  <FeedbackPostOptionsMenu
                    postId={postId}
                    authorId={data.authorId}
                    onEdit={() => setIsEditing(true)}
                  />
                </div>
              </div>
              {width < 768 && (
                <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs font-normal">
                  <span>Posted by {authorName || "Anonymous user"}</span>
                  <span className="text-[8px]">•</span>
                  <span>{timeAgo.format(createdAt, "mini-now")}</span>
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
              )}
            </div>

            <TiptapOutput content={description} />

            <div className="flex items-center gap-2.5 pt-2">
              <UpvoteButton
                postId={postId}
                upvoteCount={upvotes}
                hasUserUpvote={hasUserUpvote}
              />
              <CommentsButton commentCount={commentCount?.toString() || "0"} />
            </div>
          </div>
        )}
      </div>
    );
  }
}
