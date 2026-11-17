"use client";

import Link from "next/link";
import { ArrowBigUp, MessageSquareIcon } from "lucide-react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { Button } from "@/components/ui/button";
import { useBoardHref } from "@/hooks/use-board-href";
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
  const href = useBoardHref();
  const trpc = useTRPC();
  const client = useQueryClient();
  const query = useInfiniteQuery(
    trpc.getInsightEvidence.infiniteQueryOptions(
      { insightId: insight.id, version: insight.version },
      { getNextPageParam: (page) => page.nextCursor ?? undefined },
    ),
  );
  const stale = query.error?.data?.code === "CONFLICT";
  const retry = () =>
    stale
      ? client.invalidateQueries({ queryKey: trpc.getInsights.queryKey() })
      : query.isFetchNextPageError
        ? query.fetchNextPage()
        : query.refetch();
  const posts = query.data?.pages.flatMap((page) => page.posts) ?? [];

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

        {query.isPending && <EvidenceLoading />}

        <div className="divide-border divide-y">
          {posts.map((post) => (
            <div key={post.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={href(`/${post.id}`)}
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

        {query.isError && (
          <div role="alert" className="text-sm">
            {stale
              ? "This report changed. Refresh your insights to see its current posts."
              : "Could not load the feedback behind this insight."}{" "}
            <button className="underline" onClick={() => void retry()}>
              {stale ? "Refresh report" : "Try again"}
            </button>
          </div>
        )}
        {query.hasNextPage && !query.isFetchNextPageError && (
          <Button
            variant="outline"
            size="sm"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Show more posts
          </Button>
        )}
        {query.isSuccess && posts.length === 0 && (
          <p className="text-muted-foreground text-xs">
            The posts behind this insight are no longer available. Regenerate to
            refresh the insights.
          </p>
        )}
      </div>
    </div>
  );
}
