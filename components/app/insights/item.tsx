"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { capitalizeFirstLetter, cn } from "@/lib/utils";

type Item = Selectable<Insights>;

const getPriorityLabel = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "Low priority";
  } else if (priorityScore < 60) {
    return "Medium priority";
  } else if (priorityScore < 90) {
    return "High priority";
  } else {
    return "Critical priority";
  }
};

export function InsightsItem({ item }: { item: Item }) {
  const priorityScore = Number(item.priority);
  const priorityLabel = getPriorityLabel(priorityScore);

  return (
    <div className="border-border flex w-full flex-col items-stretch space-y-2 rounded-xl border p-6 shadow-xs">
      <div className="flex items-center gap-2">
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
              priorityScore >= 60 && priorityScore < 90,
            "text-red-700 dark:text-red-400": priorityScore >= 90,
          })}
        >
          {priorityLabel}
        </Badge>
      </div>
      <h3 className="h5 mb-2">{item.title}</h3>
      <p className="text-muted-foreground text-sm">{item.description}</p>
    </div>
  );
}
