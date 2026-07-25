"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_STATUSES,
  STATUS_DOT_CLASS,
  STATUS_TEXT_CLASS,
  formatPostCount,
} from "@/lib/insights";
import type { FeedbackStatus } from "@/lib/typings";

/**
 * The insights's only action: once an insight has been dealt with, set the status
 * on all the feedback behind it at once. Same menu, same colours and same
 * wording as the per-post status menu, so there is nothing new to learn.
 */
export function InsightStatusControl({
  status,
  isMixed,
  postCount,
  onChange,
  disabled,
}: {
  status: FeedbackStatus;
  isMixed: boolean;
  postCount: number;
  onChange: (next: FeedbackStatus) => void;
  disabled?: boolean;
}) {
  const label = status ?? (isMixed ? "Mixed" : "Set status");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`Status of the ${formatPostCount(postCount)} behind this insight: ${label}`}
          className="h-7 shrink-0 gap-1.5 px-2 text-xs font-normal"
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              status
                ? STATUS_DOT_CLASS[status]
                : "ring-muted-foreground/50 ring-1 ring-inset",
            )}
          />
          <span
            className={cn(
              status
                ? `capitalize ${STATUS_TEXT_CLASS[status]}`
                : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          <ChevronDown className="text-muted-foreground size-3!" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Applies to all {formatPostCount(postCount)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={status ?? "none"}
          onValueChange={(value) =>
            onChange(value === "none" ? null : (value as FeedbackStatus))
          }
        >
          {FEEDBACK_STATUSES.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className={cn("capitalize", `${STATUS_TEXT_CLASS[option]}!`)}
            >
              {option}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="none">No status</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
