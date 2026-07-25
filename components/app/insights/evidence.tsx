"use client";

import Link from "next/link";
import { ArrowBigUp, MessageSquareIcon } from "lucide-react";
import { useFeedbackPostsByIds } from "@/hooks/use-feedback-posts-by-ids";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { STATUS_TEXT_CLASS } from "@/lib/insights";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedbackPostOptionsMenu } from "../feedback-post/options-menu";
import type { Insight } from "@/lib/typings";

function EvidenceLoading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/**
 * The posts an insight was built from. Every claim the insights makes should be one
 * click from the raw feedback that produced it — an AI summary the admin cannot
 * check is an AI summary they cannot act on.
 *
 * The panel opens with what people actually said, then names what it is showing:
 * "the feedback behind this insight" is the sentence the whole page rests on, so
 * it is worth spending a line to say it out loud.
 */
export function InsightEvidence({ insight }: { insight: Insight }) {
  const platformUrl = usePlatformUrl();
  const {
    query: { data: posts, isPending },
  } = useFeedbackPostsByIds({ ids: insight.postIds, enabled: true });

  const sorted = [...(posts ?? [])].sort((a, b) => {
    const byUpvotes = Number(b.upvotes) - Number(a.upvotes);
    if (byUpvotes !== 0) return byUpvotes;
    return b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0;
  });

  return (
    <div className="space-y-3.5">
      {insight.signals?.evidence && (
        <p className="text-muted-foreground border-border max-w-xl border-l-2 pl-3 text-xs leading-relaxed">
          {insight.signals.evidence}
        </p>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium">
          The feedback behind this insight
        </div>

        {isPending && <EvidenceLoading />}

        <div className="divide-border divide-y">
          {sorted.map((post) => (
            <div key={post.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`${platformUrl}/${post.id}`}
                  className="text-sm leading-snug font-medium hover:underline"
                >
                  {post.title}
                </Link>
                <div className="text-muted-foreground flex shrink-0 items-center gap-2.5 text-xs">
                  <span className="flex items-center gap-0.5 tabular-nums">
                    <ArrowBigUp className="size-4" strokeWidth={1.5} />
                    {post.upvotes}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <MessageSquareIcon className="size-3" />
                    {post.commentCount}
                  </span>
                  <FeedbackPostOptionsMenu
                    postId={post.id}
                    className="text-muted-foreground h-fit py-0.5"
                  />
                </div>
              </div>
              <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span>{timeAgo.format(post.createdAt, "mini-now")}</span>
                <span className="text-[8px]">&middot;</span>
                <span className="capitalize">{post.category}</span>
                {post.status && (
                  <>
                    <span className="text-[8px]">&middot;</span>
                    <span
                      className={cn(
                        "capitalize",
                        STATUS_TEXT_CLASS[post.status],
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

        {!isPending && sorted.length === 0 && (
          <p className="text-muted-foreground text-xs">
            The posts behind this insight are no longer available. Regenerate to
            refresh the insights.
          </p>
        )}
      </div>
    </div>
  );
}
