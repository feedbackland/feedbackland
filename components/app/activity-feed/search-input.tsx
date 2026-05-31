"use client";

import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
  const [inputValue, setInputValue] = useState("");

  useDebounce(
    () => {
      onDebouncedChange(inputValue.length >= 2 ? inputValue : "");
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
        placeholder="Search activity..."
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
