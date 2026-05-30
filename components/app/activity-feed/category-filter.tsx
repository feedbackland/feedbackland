"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  counts,
  unseen,
  commentsDisabled,
  onChange,
}: {
  value: ActivityCategory;
  counts: Record<ActivityCategory, number>;
  unseen: Record<ActivityCategory, boolean>;
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
      className="w-full justify-start gap-1.5 overflow-x-auto"
    >
      {SEGMENTS.map((seg) => (
        <ToggleGroupItem
          key={seg.value}
          value={seg.value}
          disabled={seg.value === "comments" && commentsDisabled}
          aria-label={`${seg.label}, ${counts[seg.value]} items${
            unseen[seg.value] ? ", has new" : ""
          }`}
          className="data-[state=on]:border-primary data-[state=on]:bg-accent shrink-0 gap-1.5 whitespace-nowrap"
        >
          <span>{seg.label}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {counts[seg.value]}
          </span>
          {unseen[seg.value] && (
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-500"
            />
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
