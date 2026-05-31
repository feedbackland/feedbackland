"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityCategory =
  | "all"
  | "idea"
  | "issue"
  | "general feedback"
  | "comments";

const SEGMENTS: {
  value: ActivityCategory;
  trigger: string;
  item: string;
}[] = [
  { value: "all", trigger: "All types", item: "All activity" },
  { value: "idea", trigger: "Ideas", item: "Ideas" },
  { value: "issue", trigger: "Issues", item: "Issues" },
  { value: "general feedback", trigger: "General", item: "General" },
  { value: "comments", trigger: "Comments", item: "Comments" },
];

export function ActivityCategoryFilter({
  value,
  unseenCounts,
  commentsDisabled,
  onChange,
  className,
}: {
  value: ActivityCategory;
  unseenCounts: Record<ActivityCategory, number>;
  commentsDisabled: boolean;
  onChange: (value: ActivityCategory) => void;
  className?: string;
}) {
  const active = SEGMENTS.find((s) => s.value === value) ?? SEGMENTS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("gap-1.5", className)}>
          <Tag className="size-3.5!" />
          <span className="truncate">{active.trigger}</span>
          <ChevronDown className="text-muted-foreground size-3.5!" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as ActivityCategory)}
        >
          {SEGMENTS.map((seg) => {
            const count = unseenCounts[seg.value] ?? 0;
            const disabled = seg.value === "comments" && commentsDisabled;
            return (
              <DropdownMenuRadioItem
                key={seg.value}
                value={seg.value}
                disabled={disabled}
                aria-label={`${seg.item}${count > 0 ? `, ${count} new` : ""}`}
              >
                <span>{seg.item}</span>
                {count > 0 && (
                  <span className="ml-auto inline-flex h-5 items-center rounded-full border border-blue-100 bg-blue-50 px-1.5 text-[10px] font-medium tabular-nums text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                    {count} new
                  </span>
                )}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
