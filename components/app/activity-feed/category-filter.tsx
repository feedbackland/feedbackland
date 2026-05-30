"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type ActivityCategory =
  | "all"
  | "idea"
  | "issue"
  | "general feedback"
  | "comments";

const SEGMENTS: { value: ActivityCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "idea", label: "Ideas" },
  { value: "issue", label: "Issues" },
  { value: "general feedback", label: "General" },
  { value: "comments", label: "Comments" },
];

export function ActivityCategoryFilter({
  value,
  unseenCounts,
  commentsDisabled,
  onChange,
}: {
  value: ActivityCategory;
  unseenCounts: Record<ActivityCategory, number>;
  commentsDisabled: boolean;
  onChange: (value: ActivityCategory) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as ActivityCategory);
      }}
      className="w-fit max-w-full justify-start gap-0 overflow-x-auto rounded-md shadow-xs"
    >
      {SEGMENTS.map((seg) => {
        const count = unseenCounts[seg.value] ?? 0;
        return (
          <ToggleGroupItem
            key={seg.value}
            value={seg.value}
            disabled={seg.value === "comments" && commentsDisabled}
            aria-label={`${seg.label}${count > 0 ? `, ${count} new` : ""}`}
            className={cn(
              "shrink-0 gap-1.5 rounded-none border-l-0 px-3 whitespace-nowrap shadow-none",
              "first:rounded-l-md first:border-l last:rounded-r-md",
              "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
            )}
          >
            <span>{seg.label}</span>
            {count > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium tabular-nums text-white dark:bg-blue-500">
                {count}
              </span>
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
