"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

type Item = Selectable<Insights>;

const getPriority = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "Low Priority";
  } else if (priorityScore < 60) {
    return "Medium Priority";
  } else if (priorityScore < 90) {
    return "High Priority";
  } else {
    return "Critical Priority";
  }
};

export function InsightsItem({ item }: { item: Item }) {
  return (
    <div className="border-border flex w-full flex-col items-stretch space-y-1 rounded border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge>{item.category}</Badge>
        <Badge>{getPriority(Number(item.priority))}</Badge>
      </div>
      <h3 className="h3">{item.title}</h3>
      <p className="text-muted-foreground text-sm">{item.description}</p>
    </div>
  );
}
