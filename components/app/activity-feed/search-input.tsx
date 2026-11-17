"use client";

import { useAiAdmin } from "@/components/app/ai-settings/status";
import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchInputValue } from "@/lib/search/text";
import { useDebounce } from "react-use";

export const ActivityFeedSearchInput = ({
  onDebouncedChange,
  value,
  delay = 500,
  className,
}: {
  onDebouncedChange: (value: string) => void;
  value: string;
  delay?: number;
  className?: React.ComponentProps<"div">["className"];
}) => {
  const { status } = useAiAdmin();
  const [inputValue, setInputValue] = useState(value);

  useDebounce(
    () => {
      onDebouncedChange(searchInputValue(inputValue));
    },
    delay,
    [inputValue],
  );

  return (
    <InputGroup className={cn(className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="text"
        placeholder={
          status?.state === "off" && !status.keptOffAt
            ? "Searching exact words · Search by meaning with AI"
            : "Search activity..."
        }
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setInputValue("");
            e.currentTarget.blur();
          }
        }}
        aria-label="Search activity feed"
      />
      {inputValue.length > 0 && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={(e) => {
              setInputValue("");
              (
                e.currentTarget
                  .closest("[data-slot='input-group']")
                  ?.querySelector("input") as HTMLInputElement | null
              )?.focus();
            }}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
};
