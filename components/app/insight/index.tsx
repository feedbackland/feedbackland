"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { capitalizeFirstLetter, cn, getPriorityLabel } from "@/lib/utils";
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
    <div className="border-border relative flex w-full flex-col items-stretch overflow-hidden rounded-xl border shadow-xs">
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="h5 flex flex-wrap items-center">{item.title}</h3>
          <Badge
            variant="outline"
            className={cn("mt-0.5", {
              "text-blue-700 dark:text-blue-400": priorityScore < 40,
              "text-green-700 dark:text-green-400":
                priorityScore >= 40 && priorityScore < 70,
              "text-amber-700 dark:text-amber-400":
                priorityScore >= 70 && priorityScore < 95,
              "text-red-800 dark:text-red-500": priorityScore >= 95,
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
                "hover:bg-muted/40 data-[state=open]:bg-muted/40 border-t-border w-full justify-start rounded-t-none rounded-b-xl border px-4.5 py-5 transition-none hover:no-underline data-[state=open]:rounded-none [&>span]:flex! [&>span]:w-full! [&>span]:flex-1",
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

          <CollapsibleContent className="border-t-border space-y-4 border px-5 py-3">
            <InsightPosts ids={item.ids || []} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
