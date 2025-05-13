"use client";

import { useFeedbackPostsByIds } from "@/hooks/use-feedback-posts-by-ids";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { ArrowBigUp, LinkIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { InsightPostsLoading } from "./posts-loading";

export function InsightPosts({ ids }: { ids: string[] }) {
  const {
    query: { data: posts, isPending },
  } = useFeedbackPostsByIds({ ids, enabled: true });

  const platformUrl = usePlatformUrl();

  return (
    <div className="flex flex-col items-stretch space-y-3 p-0">
      {isPending && <InsightPostsLoading />}

      {posts?.map((post) => {
        return (
          <div key={post.id} className="flex items-start justify-between gap-5">
            <div className="flex items-start gap-2">
              <LinkIcon className="mt-0.5 size-3! shrink-0!"></LinkIcon>
              <div className="flex flex-col items-stretch space-y-0.5">
                <Link
                  key={post.id}
                  href={`${platformUrl}/${post.id}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <span>{post.title}</span>
                </Link>
                <div className="text-muted-foreground mb-1 flex flex-wrap items-center gap-1.5 text-xs font-normal">
                  <span>{timeAgo.format(post.createdAt)}</span>
                  <span className="text-[8px]">•</span>
                  <span className="capitalize">{post.category}</span>
                  {post.status && (
                    <>
                      <span className="text-[8px]">•</span>
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
            </div>
            <div className="text-primary flex items-center gap-4.5 text-xs">
              <div className="flex items-center gap-0.5">
                <ArrowBigUp className="size-4!" strokeWidth={1.5} />
                <span>{post.upvotes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquareIcon className="size-3" />
                <span>{post.commentCount}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
