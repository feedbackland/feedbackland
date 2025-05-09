"use client";

import { Selectable } from "kysely";
import { Insights } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

type Item = Selectable<Insights>;

export function InsightsItem({ item }: { item: Item }) {
  return (
    <div className="border-border flex flex-col items-stretch space-y-1 rounded border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge>Feature request</Badge>
        <Badge>{item.priority}</Badge>
      </div>
      <h3 className="h3">{item.title}</h3>
      <p className="text-muted-foreground text-sm">{item.description}</p>
    </div>
  );
}
