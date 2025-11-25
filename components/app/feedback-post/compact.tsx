"use client";

import { memo } from "react";
import { UpvoteButton } from "@/components/app/upvote-button";
import { cn } from "@/lib/utils";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import Link from "next/link";
import { TiptapOutput } from "@/components/ui/tiptap-output";
import { timeAgo } from "@/lib/time-ago";
import { FeedbackStatus } from "@/lib/typings";
import { CommentsButton } from "@/components/app/comments-button.tsx";
import { useRouter } from "next/navigation";
import { FeedbackPostOptionsMenu } from "./options-menu";
import { useAuth } from "@/hooks/use-auth";

function Inner({
  postId,
  authorId,
  title,
  description,
  status,
  createdAt,
  category,
  upvoteCount,
  commentCount,
  hasUserUpvote,
  className,
}: {
  postId: string;
  authorId?: string | null;
  title: string;
  description: string;
  status: FeedbackStatus;
  createdAt: Date;
  category: string | null;
  upvoteCount: string;
  commentCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const platformUrl = usePlatformUrl();
  const router = useRouter();
  const { isAdmin } = useAuth();

  return (
    <div
      className={cn(
        "border-border relative border-b py-5 pr-3.5 pl-4",
        className,
      )}
      data-post-id={postId}
    >
      {isAdmin && (
        <FeedbackPostOptionsMenu
          postId={postId}
          authorId={authorId}
          className="absolute! top-3 right-2"
        />
      )}
      <Link
        href={`${platformUrl}/${postId}`}
        className="flex flex-col items-stretch gap-3.5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col items-stretch gap-1.5">
            <div className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
              <span>{timeAgo.format(createdAt, "mini-now")}</span>
              <span className="text-[8px]">•</span>
              <span className="capitalize">{category}</span>
              {status && (
                <>
                  <span className="text-[8px]">•</span>
                  <span className={cn("", `text-${status.replace(" ", "-")}`)}>
                    {status}
                  </span>
                </>
              )}
            </div>

            <div className="-mb-1.5 flex items-start justify-between gap-4">
              <h2 className="text-[17px] leading-5 font-medium group-hover:underline">
                {title}
              </h2>
            </div>
          </div>
        </div>

        <TiptapOutput
          content={description}
          forbiddenTags={["a", "pre", "img"]}
          className="line-clamp-4"
        />

        <div className="flex items-center gap-2.5">
          <UpvoteButton
            postId={postId}
            upvoteCount={upvoteCount}
            hasUserUpvote={hasUserUpvote}
          />
          <CommentsButton
            commentCount={commentCount}
            onClick={() => {
              router.push(`${platformUrl}/${postId}`);
            }}
          />
        </div>
      </Link>
    </div>
  );
}

export const FeedbackPostCompact = memo(Inner);
