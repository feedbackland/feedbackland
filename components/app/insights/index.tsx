"use client";

import { useMemo, useState } from "react";
import { InsightJobStatus } from "./job-status";
import { Error } from "@/components/ui/error";
import { useInsights } from "@/hooks/use-insights";
import { useGenerateInsights } from "@/hooks/use-generate-insights";
import { InsightsHeader } from "./header";
import { InsightsRunStrip } from "./run-strip";
import { InsightsSearch } from "./search";
import { InsightRow } from "./insight-row";
import { InsightsLoading } from "./loading";
import {
  InsightsFirstRun,
  InsightsNoFeedback,
  InsightsNoMatches,
} from "./empty";

/** Below this many insights the whole list fits on screen, so search is noise. */
const SEARCH_THRESHOLD = 8;

export function Insights() {
  const [search, setSearch] = useState("");
  const {
    query: { data, isPending, isError, refetch },
  } = useInsights();
  const job = useGenerateInsights();

  const insights = useMemo(() => data?.insights ?? [], [data?.insights]);
  const run = data?.run ?? null;

  const handleGenerate = () => job.start.mutate();

  // The whole insights is in memory, so search runs over every insight rather
  // than over whatever happened to be loaded.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return insights;

    return insights.filter(
      (insight) =>
        insight.title.toLowerCase().includes(term) ||
        insight.description.toLowerCase().includes(term) ||
        (insight.signals?.evidence ?? "").toLowerCase().includes(term),
    );
  }, [insights, search]);

  if (isPending) return <InsightsLoading />;

  if (isError && !data) {
    return (
      <div>
        <h2 className="h5 mb-4">Insights</h2>
        <Error
          title="Could not load your insights"
          description="Something went wrong reading them. Reload the page to try again."
        />
      </div>
    );
  }

  const { isGenerating } = job;
  const openPostCount = data?.openPostCount ?? 0;

  const refreshError = isError && (
    <div role="alert" className="mb-4 text-sm">
      Could not refresh this report. Showing the last successful result.{" "}
      <button className="underline" onClick={() => void refetch()}>
        Try again
      </button>
    </div>
  );
  if (insights.length === 0) {
    return (
      <div>
        {/* No action up here: the empty state below is the call to action, and
            when there is no feedback at all there is nothing to act on. */}
        <InsightsHeader hasRun={!!run} />
        {refreshError}
        <InsightJobStatus job={job} />
        {run && <InsightsRunStrip run={run} />}
        {isGenerating ? null : openPostCount === 0 ? (
          <InsightsNoFeedback hasRun={!!run} />
        ) : (
          <InsightsFirstRun
            completedEmpty={run?.insightCount === 0}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            postCount={openPostCount}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <InsightsHeader
        hasRun={!!run}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      {refreshError}
      <InsightJobStatus job={job} />

      {insights.length >= SEARCH_THRESHOLD && (
        <InsightsSearch
          value={search}
          onChange={setSearch}
          matchCount={visible.length}
          total={insights.length}
        />
      )}

      <div className="border-border bg-background overflow-hidden rounded-lg border shadow-xs">
        {run && <InsightsRunStrip run={run} />}

        {visible.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}

        {visible.length === 0 && (
          <InsightsNoMatches onClear={() => setSearch("")} />
        )}
      </div>
    </div>
  );
}
