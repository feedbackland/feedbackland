"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebounce, useKey } from "react-use";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ActivityFeedSearchInput = ({
  onDebouncedChange,
  delay = 500,
}: {
  onDebouncedChange: (value: string) => void;
  delay?: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  useDebounce(
    () => {
      onDebouncedChange(inputValue);
    },
    delay,
    [inputValue],
  );

  const reset = () => {
    setInputValue("");
  };

  useKey("Escape", () => {
    reset();
    inputRef.current?.blur();
  });

  useEffect(() => {
    if (isFocused) {
      inputRef?.current?.focus();
    } else {
      inputRef?.current?.blur();
    }
  }, [isFocused]);

  const isActive = !!(isFocused || inputValue?.length > 0);

  if (!isActive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="link"
            className="text-muted-foreground hover:text-primary h-auto p-0 hover:no-underline"
            onClick={() => {
              setIsFocused(true);
            }}
          >
            <SearchIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Search activity feed</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("absolute top-2 right-2 left-2 z-10")}>
      <div className={cn("bg-background relative w-full max-w-full")}>
        <SearchIcon className="absolute top-[0.6rem] left-2.5 size-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={inputValue}
          onChange={handleChange}
          className={cn("bg-background! px-9 text-sm")}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
        />
        <Button
          size="icon"
          variant="link"
          className={cn(
            "text-muted-foreground hover:text-primary absolute! top-[0.17rem] right-0.5 hidden",
            inputValue?.length > 0 && "block",
          )}
          onClick={(e) => {
            reset();
            inputRef.current?.focus();
          }}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
};
