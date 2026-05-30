"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "react-use";

export const ActivityFeedSearchInput = ({
  onDebouncedChange,
  delay = 500,
  className,
}: {
  onDebouncedChange: (value: string) => void;
  delay?: number;
  className?: React.ComponentProps<"div">["className"];
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  useDebounce(
    () => {
      onDebouncedChange(inputValue.length >= 2 ? inputValue : "");
    },
    delay,
    [inputValue],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setInputValue("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search activity..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="bg-background pr-8 pl-8 text-sm"
        aria-label="Search activity feed"
      />
      {inputValue.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear search"
          onClick={() => {
            setInputValue("");
            inputRef.current?.focus();
          }}
          className="text-muted-foreground hover:text-primary absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
};
