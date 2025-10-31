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
    <div className={cn("", className)} data-post-id={postId}>
      <div className="flex flex-col items-stretch">
        <div className="flex items-start justify-between gap-4">
          <h2 className="mb-0.5 text-[17px] leading-5.5 font-semibold hover:underline active:underline">
            <Link
              href={`${platformUrl}/${postId}`}
              className="flex flex-col items-stretch space-y-1.5"
            >
              {title}
            </Link>
          </h2>
          {isAdmin && (
            <FeedbackPostOptionsMenu
              postId={postId}
              authorId={authorId}
              className="-mt-0.5"
            />
          )}
        </div>

        <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-normal">
          <span>{timeAgo.format(createdAt, "mini-now")}</span>
          <span className="text-[8px]">•</span>
          <span className="capitalize">{category}</span>
          {status && (
            <>
              <span className="text-[8px]">•</span>
              <span
                className={cn("capitalize", `text-${status.replace(" ", "-")}`)}
              >
                {status}
              </span>
            </>
          )}
        </div>
      </div>

      <TiptapOutput
        content={description}
        forbiddenTags={["a", "pre", "img"]}
        className="text-primary/70! mt-0.5 line-clamp-4"
      />

      <div className="mt-2 flex items-center gap-2.5">
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
    </div>
  );
}

export const FeedbackPostCompact = memo(Inner);
