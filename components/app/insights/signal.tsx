"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  EFFORT_LABEL,
  SCORE_WEIGHTS,
  clamp,
  formatReach,
  getPriorityDelta,
  getSignalDriver,
} from "@/lib/insights";
import type { Insight } from "@/lib/typings";

/**
 * One component of the score. A single hue across all three bars: they measure
 * different things but the same quantity — how much this insight has of it — so
 * colouring them apart would imply a distinction that is not there.
 *
 * The weight sits in the label rather than in a hover title, because how much
 * each part counts is half of what this panel is here to explain.
 */
function ScoreBar({
  label,
  detail,
  value,
  weight,
}: {
  label: string;
  detail: string;
  value: number;
  weight: number;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr_1.75rem] items-center gap-2">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">
          {label}{" "}
          <span className="text-muted-foreground font-normal tabular-nums">
            {Math.round(weight * 100)}%
          </span>
        </div>
        <div className="text-muted-foreground truncate text-[11px]">
          {detail}
        </div>
      </div>

      {/* Decorative: the label, the detail and the number beside it already say
          everything the bar says. */}
      <div
        aria-hidden
        className="bg-foreground/10 h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-foreground/70 h-full rounded-full"
          style={{ width: `${clamp(value, 2, 100)}%` }}
        />
      </div>

      <div className="text-muted-foreground text-right text-xs tabular-nums">
        {Math.round(value)}
      </div>
    </div>
  );
}

/**
 * How strong the case for an insight is, without asking anyone to interpret a
 * number out of 100.
 *
 * The meter is the whole point: read down the right edge and the list's falloff
 * is obvious at a glance, with no scale to learn. A word appears beside it only
 * when one of the three signals clearly leads — then it says *why* this one is
 * up here. Most rows show the meter alone, which is what keeps the column calm.
 * The number, and the arithmetic behind it, live one click away.
 */
export function InsightSignal({ insight }: { insight: Insight }) {
  const signals = insight.signals;
  const delta = getPriorityDelta(insight);
  const driver = getSignalDriver(insight);

  // Five discrete bars rather than a continuous fill: at this size a segmented
  // meter reads as signal strength at a glance, where a 36px sliver of colour
  // just reads as a dash.
  const filled = clamp(Math.ceil(insight.priority / 20), 1, 5);

  const meter = (
    <>
      {driver && (
        <span className="text-muted-foreground xs:inline hidden text-xs font-medium whitespace-nowrap select-none">
          {driver}
        </span>
      )}
      <span aria-hidden className="flex shrink-0 items-end gap-[3px]">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={cn(
              "w-[3px] rounded-[1px] transition-colors",
              // Rising heights make the meter legible even in a single glance
              // and even without colour.
              ["h-1.5", "h-2", "h-2.5", "h-3", "h-3.5"][index],
              index < filled
                ? "bg-foreground/80 group-hover/signal:bg-foreground"
                : "bg-foreground/15",
            )}
          />
        ))}
      </span>
    </>
  );

  // The negative right margin lands the last bar on the row's content edge, so
  // the meters line up with the status controls below them.
  const shell =
    "-mr-1.5 flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1";

  // Rows written before the score was broken down have nothing to explain, so
  // they show the meter without pretending to be interactive.
  if (!signals) {
    return (
      <span
        className={shell}
        title={`Priority ${insight.priority} of 100`}
        aria-label={`Priority ${insight.priority} of 100`}
      >
        {meter}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Priority ${insight.priority} of 100. Show how it was calculated.`}
          className={cn(
            shell,
            "group/signal hover:bg-muted focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          {meter}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">
            Priority {insight.priority}
          </span>
          {delta !== null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {delta > 0 ? "+" : ""}
              {delta} since the last run
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          <ScoreBar
            label="Reach"
            detail={formatReach(signals.reach)}
            value={signals.reachScore}
            weight={SCORE_WEIGHTS.reach}
          />
          <ScoreBar
            label="Momentum"
            detail={`${signals.recentUpvotes + signals.recentCommentCount} in 30 days`}
            value={signals.momentumScore}
            weight={SCORE_WEIGHTS.momentum}
          />
          <ScoreBar
            label="Severity"
            detail="Impact per user"
            value={signals.severityScore}
            weight={SCORE_WEIGHTS.severity}
          />
        </div>

        <p className="text-muted-foreground border-t pt-2.5 text-[11px] leading-relaxed">
          Reach and momentum are scored against the strongest insight in this
          run. Reach counts distinct people, so one person upvoting duplicates
          counts once. Severity is the model&apos;s read of the problem, not of
          demand.
          {insight.effort && signals.effortMultiplier !== 1 && (
            <>
              {" "}
              {EFFORT_LABEL[insight.effort]} effort applies a{" "}
              <span className="tabular-nums">
                ×{signals.effortMultiplier.toFixed(2)}
              </span>{" "}
              adjustment.
            </>
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}
