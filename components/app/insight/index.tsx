"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn, getPriorityLabel, getPriorityLevel } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { ChevronRight, ArrowBigUp, MessageSquareText } from "lucide-react";
import { InsightPosts } from "./posts";
import { useAtom } from "jotai";
import { expandedInsightsAtom } from "@/lib/atoms";

type Item = Selectable<Insights>;

const priorityDotColors = {
  low: "bg-blue-500",
  medium: "bg-green-500",
  high: "bg-yellow-500",
  critical: "bg-red-500",
};

const priorityBadgeColors = {
  low: "text-blue-700 dark:text-blue-400",
  medium: "text-green-700 dark:text-green-400",
  high: "text-yellow-600 dark:text-yellow-400",
  critical: "text-red-700 dark:text-red-500",
};

const statusColors: Record<string, string> = {
  "under consideration": "text-under-consideration",
  planned: "text-planned",
  "in progress": "text-in-progress",
  done: "text-done",
  declined: "text-declined",
};

export function Insight({ item }: { item: Item }) {
  const priorityScore = Number(item.priority);
  const priorityLevel = getPriorityLevel(priorityScore);
  const priorityLabel = getPriorityLabel(priorityScore);

  const [openStates, setOpenStates] = useAtom(expandedInsightsAtom);
  const isOpen = openStates[item.id] || false;

  const setIsOpen = (open: boolean) => {
    setOpenStates((prev) => ({ ...prev, [item.id]: open }));
  };

  const postCount = item.ids?.length || 0;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pt-5">
          <CardTitle className="text-base leading-snug tracking-tight">
            {item.title}
          </CardTitle>

          <CardAction>
            <Badge
              variant="outline"
              className={cn("gap-1.5", priorityBadgeColors[priorityLevel])}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  priorityDotColors[priorityLevel],
                )}
              />
              {priorityLabel}
            </Badge>
          </CardAction>

          <CardDescription className="flex items-center gap-3">
            {item.status && (
              <Badge
                variant="outline"
                className={cn("capitalize", statusColors[item.status])}
              >
                {item.status}
              </Badge>
            )}
            <span className="flex items-center gap-1 text-xs">
              <ArrowBigUp className="size-3.5" strokeWidth={1.5} />
              <span className="tabular-nums">{item.upvotes}</span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              <MessageSquareText className="size-3" />
              <span className="tabular-nums">{item.commentCount}</span>
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-3 pb-5">
          <p className="text-muted-foreground text-sm leading-normal">
            {item.description}
          </p>
        </CardContent>

        {postCount > 0 && (
          <>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "text-muted-foreground flex w-full items-center gap-2 border-t px-6 py-3 text-xs font-medium transition-colors",
                  "hover:bg-muted/50 hover:text-foreground",
                  isOpen && "text-foreground",
                )}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
                Based on {postCount}{" "}
                {postCount === 1 ? "feedback post" : "feedback posts"}
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="bg-muted/20 border-t px-6 py-4">
                <InsightPosts ids={item.ids || []} />
              </div>
            </CollapsibleContent>
          </>
        )}
      </Collapsible>
    </Card>
  );
}
