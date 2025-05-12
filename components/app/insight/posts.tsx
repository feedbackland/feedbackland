"use client";

import { useFeedbackPostsByIds } from "@/hooks/use-feedback-posts-by-ids";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { ArrowBigUp, MessageSquareIcon } from "lucide-react";
import Link from "next/link";

export function InsightPosts({ ids }: { ids: string[] }) {
  const {
    query: { data: posts },
  } = useFeedbackPostsByIds({ ids, enabled: true });

  const platformUrl = usePlatformUrl();

  return (
    <div className="flex flex-col items-stretch space-y-3.5 p-0">
      {posts?.map((post) => {
        return (
          <div key={post.id} className="flex items-center justify-between">
            <Link
              key={post.id}
              href={`${platformUrl}/${post.id}`}
              className="text-sm hover:underline"
            >
              {post.title}
            </Link>
            <div className="text-primary flex items-center gap-4.5 text-xs">
              <div className="flex items-center gap-1">
                <MessageSquareIcon className="size-3" />
                <span>{post.commentCount}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <ArrowBigUp className="size-4!" strokeWidth={1.5} />
                <span>{post.upvotes}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
