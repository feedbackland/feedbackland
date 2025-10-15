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
