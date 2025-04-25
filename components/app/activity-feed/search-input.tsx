"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebounce, useKey } from "react-use";

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
  });

  return (
    <div className={cn("relative w-full max-w-52 transition-none", className)}>
      <SearchIcon className="absolute top-[0.6rem] left-2.5 size-4" />
      <Input
        type="text"
        placeholder="Search..."
        value={inputValue}
        onChange={handleChange}
        className={cn("bg-background! px-9 text-sm")}
      />
      <Button
        size="icon"
        variant="link"
        className={cn(
          "text-muted-foreground hover:text-primary absolute! top-[0.17rem] right-0.5 hidden",
          inputValue?.length > 0 && "block",
        )}
        onClick={() => {
          reset();
        }}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
};
