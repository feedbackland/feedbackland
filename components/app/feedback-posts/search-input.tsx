"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebounce } from "react-use";

export const FeedbackPostsSearchInput = ({
  onDebouncedChange,
  delay = 500,
  className,
}: {
  onDebouncedChange: (value: string) => void;
  delay?: number;
  className?: React.ComponentProps<"div">["className"];
}) => {
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

  const isActive = !!(isFocused || inputValue?.length > 0);

  return (
    <div
      className={cn(
        "bg-background relative w-full max-w-52 transition-none",
        isActive && "absolute top-0 right-0 left-0 z-10 max-w-full",
        className,
      )}
    >
      <SearchIcon className="absolute top-[0.6rem] left-2.5 size-4" />
      <Input
        type="text"
        placeholder="Search..."
        value={inputValue}
        onChange={handleChange}
        className={cn("px-9 text-sm")}
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
          "text-muted-foreground hover:text-primary absolute! top-[0.2rem] right-0.5 hidden",
          inputValue?.length > 0 && "block",
        )}
        onClick={reset}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
};
