"use client";

import { useRef, useState } from "react";
import { useDebounce } from "react-use";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function InsightsSearch({
  value,
  onChange,
  matchCount,
  total,
}: {
  value: string;
  onChange: (next: string) => void;
  matchCount: number;
  total: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  useDebounce(() => onChange(draft), 200, [draft]);

  const clear = () => {
    setDraft("");
    onChange("");
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="relative w-full sm:max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          placeholder="Search insights"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              clear();
              inputRef.current?.blur();
            }
          }}
          className="bg-background pr-9 pl-9"
        />
        {draft && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear search"
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Keyed off the committed term, not the draft, so the count never
          disagrees with the rows underneath it. The run strip keeps reporting
          the run; this reports the filter. */}
      {value.trim() && (
        <p
          aria-live="polite"
          className="text-muted-foreground text-xs tabular-nums"
        >
          Showing {matchCount} of {total}
        </p>
      )}
    </div>
  );
}
