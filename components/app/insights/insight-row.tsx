"use client";

import { useAtom } from "jotai";
import { toast } from "sonner";
import { ChevronDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { expandedInsightsAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";
import { formatPostCount, formatReach, getReachDelta } from "@/lib/insights";
import { useSetInsightStatus } from "@/hooks/use-set-insight-status";
import type { FeedbackStatus, Insight } from "@/lib/typings";
import { InsightSignal } from "./signal";
import { InsightStatusControl } from "./status-control";
import { InsightEvidence } from "./evidence";

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
      <div className="px-4 py-4 sm:px-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="min-w-0 text-[15px] leading-snug font-semibold">
              {insight.title}
              {insight.isNew && (
                <Badge
                  variant="secondary"
                  className="ml-2 -translate-y-px px-1.5 py-0 align-middle text-[10px] tracking-wide uppercase"
                >
                  New
                </Badge>
              )}
            </h3>
            <InsightSignal insight={insight} />
          </div>

          {/* Held to a readable measure rather than the full width of the page:
              at 1000px the description ran to well over 100 characters a line,
              which is where prose stops being scannable. The space it gives up
              is the column the meter and the status control live in. */}
          <p className="text-muted-foreground max-w-xl text-sm leading-normal">
            {insight.description}
          </p>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-2 pt-1 text-xs">
            {/* Reach and its change are one fact, so they sit closer to each
                other than to anything else on the line. */}
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums">{formatReach(insight.reach)}</span>

              {reachDelta !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-foreground/80 inline-flex cursor-default items-center gap-0.5 tabular-nums">
                      <TrendingUp aria-hidden className="size-3" />+{reachDelta}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {reachDelta} more {reachDelta === 1 ? "person" : "people"}{" "}
                    since the last run
                  </TooltipContent>
                </Tooltip>
              )}
            </span>

            {/* The post count is the disclosure: the number is the way in to
                the feedback it counts, so no extra control is needed. It gets a
                button's padding and hover so it reads as one, which is also
                what separates it from the reach beside it — no bullet needed. */}
            <CollapsibleTrigger className="hover:bg-muted hover:text-foreground focus-visible:ring-ring -my-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none">
              {formatPostCount(postCount)}
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-3.5 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </CollapsibleTrigger>

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

      {/* Same height transition the Accordion uses, keyed to Collapsible's own
          height variable. It matters here: the panel opens mid-list, and a snap
          shifts every row below it with nothing to say why. */}
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden motion-reduce:animate-none">
        <div className="bg-muted/40 border-t px-4 py-4 sm:px-5">
          <InsightEvidence insight={insight} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
