"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What the page is for, stated the same way every time you land on it.
 *
 * The run's own numbers used to live here, which meant that after the first
 * analysis the page never again said what it was — a stats line cannot. Those
 * numbers now head the list they produced (see <InsightsRunStrip />), leaving
 * this line free to name the job: many individual posts in, a handful of
 * recurring themes out.
 *
 * The action follows the same logic. The first run is the page's call to action
 * and is styled as one; once a run exists the insights are the thing worth
 * looking at, so keeping them company is a quieter outline button. When there is
 * no list yet, the empty state below owns the call to action and `onGenerate` is
 * left off — one screen, one primary action.
 */
export function InsightsHeader({
  hasRun,
  onGenerate,
  isGenerating,
}: {
  hasRun: boolean;
  onGenerate?: () => void;
  isGenerating?: boolean;
}) {
  const Icon = hasRun ? RefreshCw : Sparkles;

  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="h5">Insights</h2>
        <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-normal">
          The themes that keep coming up across your feedback, ranked by what to
          build or fix next.
        </p>
      </div>

      {onGenerate && (
        <Button
          onClick={onGenerate}
          loading={isGenerating}
          variant={hasRun ? "outline" : "default"}
          className="shrink-0"
        >
          <Icon className="size-4" />
          {hasRun ? "Regenerate" : "Generate"}
        </Button>
      )}
    </div>
  );
}
