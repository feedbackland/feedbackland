"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Error } from "@/components/ui/error";
import { Spinner } from "@/components/ui/spinner";
import { useInsights } from "@/hooks/use-insights";
import { useGenerateInsights } from "@/hooks/use-generate-insights";
import { InsightsHeader } from "./header";
import { InsightsSearch } from "./search";
import { InsightRow } from "./insight-row";
import { InsightsLoading } from "./loading";
import { InsightsFirstRun, InsightsNoFeedback, InsightsNoMatches } from "./empty";

/** Below this many insights the whole list fits on screen, so search is noise. */
const SEARCH_THRESHOLD = 8;

export function Insights() {
  const [search, setSearch] = useState("");
  const {
    query: { data, isPending, isError },
  } = useInsights();
  const generate = useGenerateInsights();

  const insights = useMemo(() => data?.insights ?? [], [data?.insights]);
  const run = data?.run ?? null;

  const handleGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () =>
        toast.success("Insights updated", { position: "top-right" }),
      onError: (error) =>
        toast.error(error.message || "The analysis didn't finish.", {
          position: "top-right",
        }),
    });
  };

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

  if (isError) {
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

  const isGenerating = generate.isPending;
  const openPostCount = data?.openPostCount ?? 0;

  if (insights.length === 0) {
    return (
      <div>
        <InsightsHeader
          run={run}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
        {isGenerating ? (
          <InsightsLoading />
        ) : openPostCount === 0 ? (
          <InsightsNoFeedback />
        ) : (
          <InsightsFirstRun
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
        run={run}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      {isGenerating && (
        <div
          role="status"
          className="border-border bg-muted/40 text-muted-foreground mb-4 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
        >
          <Spinner className="size-4 shrink-0" />
          <span>
            Reading your feedback. What&apos;s below stays put until the new
            insights are ready.
          </span>
        </div>
      )}

      {insights.length >= SEARCH_THRESHOLD && (
        <InsightsSearch value={search} onChange={setSearch} />
      )}

      <div className="border-border bg-background rounded-lg border shadow-xs">
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
