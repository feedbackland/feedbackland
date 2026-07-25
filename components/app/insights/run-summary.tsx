"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { timeAgo } from "@/lib/time-ago";
import type { InsightsRun } from "@/lib/typings";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

/**
 * What the last run actually did, stated plainly. An analysis that hides how
 * much it read — or how much it could not group — asks to be trusted on faith;
 * this is the line that makes the insights auditable at a glance.
 */
export function RunSummary({ run }: { run: InsightsRun }) {
  const ungrouped = Math.max(0, run.postsAnalyzed - run.postsClustered);
  const skipped = Math.max(0, run.postsTotal - run.postsAnalyzed);

  const headline = [
    `${run.postsAnalyzed} ${run.postsAnalyzed === 1 ? "post" : "posts"} → ${run.insightCount} ${run.insightCount === 1 ? "insight" : "insights"}`,
    run.newInsightCount > 0 ? `${run.newInsightCount} new` : null,
    ungrouped > 0 ? `${ungrouped} not grouped` : null,
    timeAgo.format(run.createdAt, "round"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mx-1 rounded px-1 text-left text-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {headline}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 space-y-2.5">
        <div className="text-sm font-semibold">Last analysis</div>

        <div className="space-y-1.5">
          <Line
            label="Ran"
            value={new Date(run.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
          <Line
            label="Feedback read"
            value={`${run.postsAnalyzed} of ${run.postsTotal} posts`}
          />
          <Line label="Grouped into" value={`${run.insightCount} insights`} />
          <Line label="No clear grouping" value={`${ungrouped} posts`} />
          <Line label="New this run" value={`${run.newInsightCount} insights`} />
          <Line
            label="Dropped off"
            value={`${run.archivedInsightCount} insights`}
          />
        </div>

        <p className="text-muted-foreground border-t pt-2.5 text-[11px] leading-relaxed">
          {skipped > 0 ? (
            <>
              {skipped} closed or lower-signal posts were left out of this run.{" "}
            </>
          ) : null}
          An insight drops off once the feedback behind it is marked done or
          declined.
          {run.model && (
            <>
              {" "}
              Analysed by <span className="font-mono">{run.model}</span>.
            </>
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}
