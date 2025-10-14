"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebounce } from "react-use";
import { useSetAtom } from "jotai";
import { feedbackPostsStateAtom } from "@/lib/atoms";

export const FeedbackPostsSidebarSearch = ({
  delay = 500,
  className,
}: {
  delay?: number;
  className?: React.ComponentProps<"div">["className"];
}) => {
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setFeedbackPostsState = useSetAtom(feedbackPostsStateAtom);
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  useDebounce(
    () => {
      setFeedbackPostsState((prev) => ({
        ...prev,
        searchValue: inputValue,
      }));
    },
    delay,
    [inputValue],
  );

  useEffect(() => {
    if (isFocused) {
      inputRef?.current?.focus();
    }
  }, [isFocused]);

  return (
    <div
      ref={inputContainerRef}
      className={cn("bg-background relative w-full", className)}
    >
      <SearchIcon className="absolute top-[0.6rem] left-2.5 z-10 size-4" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={inputValue}
        onChange={handleChange}
        className={cn("bg-background! relative px-9 text-sm")}
        onFocus={() => setIsFocused(true)}
      />
      <Button
        size="icon"
        variant="link"
        className={cn(
          "text-muted-foreground hover:text-primary absolute! top-[0.17rem] right-0.5 hidden",
          inputValue?.length > 0 && "block",
        )}
        onClick={() => {
          setInputValue("");
          inputRef.current?.focus();
        }}
      >
        <XIcon className="size-4" />
        <span className="sr-only">Close search</span>
      </Button>
    </div>
  );
};
