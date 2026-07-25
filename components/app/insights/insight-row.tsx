"use client";

import { useAtom } from "jotai";
import { toast } from "sonner";
import { ChevronDown, TrendingUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { expandedInsightsAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";
import { formatPostCount, formatReach, getReachDelta } from "@/lib/insights";
import { useSetInsightStatus } from "@/hooks/use-set-insight-status";
import type { FeedbackStatus, Insight } from "@/lib/typings";
import { InsightSignal } from "./signal";
import { InsightStatusControl } from "./status-control";
import { InsightEvidence } from "./evidence";

function Dot() {
  return (
    <span aria-hidden className="text-[8px]">
      &middot;
    </span>
  );
}

export function InsightRow({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useAtom(expandedInsightsAtom);
  const setStatus = useSetInsightStatus();

  const isOpen = expanded[insight.id] ?? false;
  const postCount = insight.postIds.length;
  const reachDelta = getReachDelta(insight);

  const handleStatus = (next: FeedbackStatus) => {
    setStatus.mutate(
      { insightId: insight.id, status: next },
      {
        onSuccess: () =>
          toast.success(
            next
              ? `${formatPostCount(postCount)} marked "${next}"`
              : `Status cleared on ${formatPostCount(postCount)}`,
            { position: "top-right" },
          ),
        onError: () =>
          toast.error("That status didn't save. Try again.", {
            position: "top-right",
          }),
      },
    );
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) =>
        setExpanded((prev) => ({ ...prev, [insight.id]: open }))
      }
      className="border-border border-b last:border-b-0"
    >
      <div className="px-3 py-3.5 sm:px-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm leading-snug font-semibold">
              {insight.title}
              {insight.isNew && (
                <span className="text-in-progress ml-2 align-middle text-[10px] font-semibold tracking-wide uppercase">
                  New
                </span>
              )}
            </h3>
            <InsightSignal insight={insight} />
          </div>

          <p className="text-muted-foreground text-sm leading-normal">
            {insight.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 pt-0.5">
            <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="tabular-nums">{formatReach(insight.reach)}</span>
              {reachDelta !== null && (
                <span
                  title={`${reachDelta} more ${reachDelta === 1 ? "person" : "people"} since the last run`}
                  className="text-foreground/80 inline-flex items-center gap-0.5 tabular-nums"
                >
                  <TrendingUp className="size-3" />+{reachDelta}
                </span>
              )}
              <Dot />
              {/* The post count is the disclosure: the number is the way in to
                  the feedback it counts, so no extra control is needed. */}
              <CollapsibleTrigger className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-0.5 rounded tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none">
                {formatPostCount(postCount)}
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
            </div>

            <div className="ml-auto">
              <InsightStatusControl
                status={insight.status}
                isMixed={insight.isMixedStatus}
                postCount={postCount}
                onChange={handleStatus}
                disabled={setStatus.isPending}
              />
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent>
        <div className="bg-muted/40 border-t px-3 py-3.5 sm:px-4">
          <InsightEvidence insight={insight} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
