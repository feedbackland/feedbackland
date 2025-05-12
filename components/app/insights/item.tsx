"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowBigUp,
  ChevronRight,
  ChevronsUpDown,
  MessageSquareIcon,
} from "lucide-react";

type Item = Selectable<Insights>;

const getPriorityLabel = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "Low priority";
  } else if (priorityScore < 60) {
    return "Medium priority";
  } else if (priorityScore < 95) {
    return "High priority";
  } else {
    return "Critical priority";
  }
};

export function InsightsItem({ item }: { item: Item }) {
  const priorityScore = Number(item.priority);
  const priorityLabel = getPriorityLabel(priorityScore);

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-border flex w-full flex-col items-stretch overflow-hidden rounded-xl border shadow-xs">
      <div className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="outline">
            {capitalizeFirstLetter(item.category || "")}
          </Badge>
          <Badge
            variant="outline"
            className={cn("", {
              "text-blue-700 dark:text-blue-400": priorityScore < 40,
              "text-green-700 dark:text-green-400":
                priorityScore >= 40 && priorityScore < 60,
              "text-orange-700 dark:text-orange-400":
                priorityScore >= 60 && priorityScore < 95,
              "text-red-700 dark:text-red-400": priorityScore >= 95,
            })}
          >
            {priorityLabel}
          </Badge>
        </div>
        <h3 className="h5 mb-2">{item.title}</h3>
        <p className="text-muted-foreground text-sm">{item.description}</p>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="link"
            size="lg"
            className={cn(
              "bg-muted/40 hover:bg-muted border-t-border w-full justify-start rounded-t-none rounded-b-xl border px-5 py-5.5 transition-none hover:no-underline data-[state=open]:rounded-none [&>span]:flex! [&>span]:w-full! [&>span]:flex-1",
            )}
          >
            <div className="flex w-full! flex-1 items-center justify-between">
              <div className="flex flex-1 items-center justify-between gap-1">
                {/* <ChevronRight
                  className={cn(
                    "text-muted-foreground size-4!",
                    isOpen ? "rotate-90" : "",
                  )}
                /> */}
                <span className="text-muted-foreground text-sm font-medium">
                  8 feedback posts used for this insight
                </span>

                <ChevronRight
                  className={cn(
                    "text-muted-foreground size-4!",
                    isOpen ? "rotate-90" : "-rotate-90",
                  )}
                />
              </div>
              {/* <div className="text-muted-foregroundtext-sm flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  <MessageSquareIcon className="size-3.5" />
                  <span>8</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <ArrowBigUp className="size-4.5!" strokeWidth={1.5} />
                  <span>8</span>
                </div>
              </div> */}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t-border space-y-4 border px-5 py-3">
          <div className="flex w-full! flex-1 items-center justify-between">
            <div className="text-primary text-sm font-medium">Zolg</div>
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <div className="flex items-center gap-0.5">
                <MessageSquareIcon className="size-3.5" />
                <span>8</span>
              </div>
              <div className="flex items-center gap-0.5">
                <ArrowBigUp className="size-4.5!" strokeWidth={1.5} />
                <span>8</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
