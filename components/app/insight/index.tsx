"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn, getPriorityLabel } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { InsightPosts } from "./posts";
import { useAtom } from "jotai";
import { expandedInsightsAtom } from "@/lib/atoms";

type Item = Selectable<Insights>;

export function Insight({ item, index }: { item: Item; index: number }) {
  const priorityScore = Number(item.priority);
  const priorityLabel = getPriorityLabel(priorityScore);

  const [openStates, setOpenStates] = useAtom(expandedInsightsAtom);

  const isOpen = openStates[item.id] || false;

  const setIsOpen = (open: boolean) => {
    setOpenStates((prev) => ({ ...prev, [item.id]: open }));
  };

  const postCount = item.ids?.length || 0;

  return (
    <div className="border-border relative flex w-full flex-col items-stretch overflow-hidden rounded-lg border shadow-xs">
      <div className="p-4 pt-3">
        <div className="mb-2 flex flex-col items-start justify-between gap-2 sm:flex-row">
          <h3 className="h5 flex flex-wrap items-center">
            {index + 1}. {item.title}
          </h3>
          <Badge
            variant="outline"
            className={cn("mt-0.5", {
              "text-blue-800 dark:text-blue-400": priorityScore < 40,
              "text-green-700 dark:text-green-400":
                priorityScore >= 40 && priorityScore < 70,
              "text-yellow-600 dark:text-yellow-400":
                priorityScore >= 70 && priorityScore < 95,
              "text-red-700 dark:text-red-500": priorityScore >= 95,
            })}
          >
            {priorityLabel}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{item.description}</p>
      </div>

      {postCount > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="link"
              size="lg"
              className={cn(
                "bg-muted/40 hover:bg-muted/60 border-border w-full justify-start rounded-t-none rounded-b-[11px] border-t px-3.5 py-3.5 transition-none hover:no-underline data-[state=open]:rounded-none [&>span]:flex! [&>span]:w-full! [&>span]:flex-1",
              )}
            >
              <div className="flex w-full! flex-1 items-center justify-between">
                <div className="flex flex-1 items-center gap-1.5">
                  <ChevronRight
                    className={cn(
                      "text-muted-foreground size-4!",
                      isOpen ? "rotate-90" : "rotate-0",
                    )}
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    Based on {postCount} feedback{" "}
                    {postCount === 1 ? "post" : "posts"}
                  </span>
                </div>
              </div>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="border-border space-y-4 border-t px-4 py-3">
            <InsightPosts ids={item.ids || []} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
