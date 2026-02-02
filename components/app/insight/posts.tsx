"use client";

import { useFeedbackPostsByIds } from "@/hooks/use-feedback-posts-by-ids";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { ArrowBigUp, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { InsightPostsLoading } from "./posts-loading";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";

export function InsightPosts({ ids }: { ids: string[] }) {
  const {
    query: { data: posts, isPending },
  } = useFeedbackPostsByIds({ ids, enabled: true });

  const platformUrl = usePlatformUrl();

  return (
    <div className="divide-y divide-border">
      {isPending && <InsightPostsLoading />}

      {posts
        ?.sort((a, b) => {
          if (a.upvotes === b.upvotes) {
            return b.createdAt > a.createdAt
              ? -1
              : b.createdAt < a.createdAt
                ? 1
                : 0;
          }

          return Number(b.upvotes) - Number(a.upvotes);
        })
        .map((post) => (
          <div key={post.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <Link
                href={`${platformUrl}/${post.id}`}
                className="text-sm font-medium leading-snug hover:underline"
              >
                {post.title}
              </Link>
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                <FeedbackPostOptionsMenu
                  postId={post.id}
                  authorId={undefined}
                  className="h-fit py-0.5 text-muted-foreground"
                />
                <span className="flex items-center gap-0.5">
                  <ArrowBigUp className="size-4" strokeWidth={1.5} />
                  {post.upvotes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquareIcon className="size-3" />
                  {post.commentCount}
                </span>
              </div>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{timeAgo.format(post.createdAt, "mini-now")}</span>
              <span className="text-[8px]">&middot;</span>
              <span className="capitalize">{post.category}</span>
              {post.status && (
                <>
                  <span className="text-[8px]">&middot;</span>
                  <span
                    className={cn(
                      "capitalize",
                      `text-${post.status.replace(" ", "-")}`,
                    )}
                  >
                    {post.status}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
