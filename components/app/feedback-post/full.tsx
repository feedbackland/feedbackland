"use client";

import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { timeAgo } from "@/lib/time-ago";
import { Button } from "@/components/ui/button";
import { FeedbackPostUpvoteButton } from "./upvote-button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { GoBackButton } from "./go-back-button";
import { useEffect } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { usePlatformUrl } from "@/hooks/use-platform-url";
// import { useSubdomain } from "@/hooks/useSubdomain";

export function FeedbackPostFull({
  postId,
  className,
  onLoaded,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
  onLoaded?: () => void;
}) {
  // const platformUrl = usePlatformUrl();
  // const subdomain = useSubdomain();

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
    } = data;

    return (
      <div className="mt-3">
        <div className="mb-3 -ml-11 flex items-center gap-2">
          <GoBackButton className="" />
          <Avatar className="">
            <AvatarImage src={authorPhotoURL || undefined} />
            <AvatarFallback>{authorName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-0">
            <div className="text-primary text-xs font-normal">{authorName}</div>
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-normal">
              <span>{timeAgo.format(createdAt)}</span>
              <span className="text-[8px]">•</span>
              <span className="capitalize">{category}</span>
            </div>
          </div>
        </div>

        <div className={cn("flex flex-col items-stretch space-y-2", className)}>
          {/* <div className="flex flex-col items-stretch">
            <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-normal">
              <span>{timeAgo.format(createdAt)}</span>
              <span className="text-[8px]">•</span>
              <span className="capitalize">{category}</span>
              <span className="text-[8px]">•</span>
              <span className="capitalize">
                by{" "}
                {authorName ? (
                  <Link
                    prefetch={false}
                    href="#"
                    className="hover:text-primary underline hover:underline"
                  >
                    {authorName}
                  </Link>
                ) : (
                  "unknown author"
                )}
              </span>
            </div>
            <h2 className="text-xl font-semibold">{title}</h2>
          </div> */}

          <h2 className="text-xl font-semibold">{title}</h2>

          <div className="tiptap-output">
            {parse(DOMPurify.sanitize(description))}
          </div>

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
      </div>
    );
  }
}
