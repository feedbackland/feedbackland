"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunSummary } from "./run-summary";
import type { InsightsRun } from "@/lib/typings";

export function InsightsHeader({
  run,
  onGenerate,
  isGenerating,
}: {
  run: InsightsRun | null;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="h5">Insights</h2>
        {run ? (
          <div className="mt-0.5">
            <RunSummary run={run} />
          </div>
        ) : (
          <p className="text-muted-foreground mt-0.5 text-sm">
            Your feedback, ranked by what to build or fix next.
          </p>
        )}
      </div>

      <Button
        onClick={onGenerate}
        loading={isGenerating}
        className="shrink-0 gap-2"
      >
        <RefreshCw className="size-4" />
        {run ? "Regenerate" : "Generate"}
      </Button>
    </div>
  );
}
