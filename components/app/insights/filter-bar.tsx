"use client";

import { useRef, useState } from "react";
import { InsightsState } from "@/lib/atoms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Search, X, ArrowUpDown } from "lucide-react";
import { useDebounce } from "react-use";

interface FilterBarProps {
  state: InsightsState;
  onStateChange: (updates: Partial<InsightsState>) => void;
}

const sortOptions: { value: InsightsState["sortBy"]; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "upvotes", label: "Most Upvotes" },
  { value: "commentCount", label: "Most Comments" },
  { value: "newest", label: "Newest First" },
];

export function InsightsFilterBar({ state, onStateChange }: FilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(state.searchValue);

  useDebounce(() => onStateChange({ searchValue: inputValue }), 300, [
    inputValue,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setInputValue("");
      inputRef.current?.blur();
    }
  };

  const activeSortLabel =
    sortOptions.find((o) => o.value === state.sortBy)?.label ?? "Sort";

  return (
    <div className="flex items-center gap-2">
      <div className="relative max-w-sm flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          placeholder="Search..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-background pr-9 pl-9"
        />
        {inputValue && (
          <button
            type="button"
            tabIndex={-1}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5"
            onClick={() => {
              setInputValue("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1.5">
            <ArrowUpDown className="size-3.5" />
            <span className="hidden sm:inline">{activeSortLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
            Sort by
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={state.sortBy}
            onValueChange={(value) =>
              onStateChange({ sortBy: value as InsightsState["sortBy"] })
            }
          >
            {sortOptions.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
