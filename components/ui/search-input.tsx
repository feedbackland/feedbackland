import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface InputProps {
  onDebouncedChange: (value: string) => void;
  delay?: number; // Optional delay in milliseconds (default: 500ms)
  className?: React.ComponentProps<"div">["className"];
}

export const SearchInput: React.FC<InputProps> = ({
  onDebouncedChange,
  delay = 500,
  className,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, delay);

    return () => {
      clearTimeout(timeoutId); // Clear the timeout if the component unmounts or inputValue changes
    };
  }, [inputValue, delay]);

  useEffect(() => {
    onDebouncedChange(debouncedValue);
  }, [debouncedValue, onDebouncedChange]);

  const reset = () => {
    setInputValue("");
    setDebouncedValue("");
  };

  const isActive = !!(isFocused || inputValue?.length > 0);

  return (
    <div
      className={cn(
        "relative w-full max-w-60 bg-background",
        isActive && "absolute left-0 right-0 top-0 z-10 max-w-full",
        className,
      )}
    >
      <SearchIcon className="absolute left-3 top-2.5 size-4" />
      <Input
        type="text"
        placeholder="Search..."
        value={inputValue}
        onChange={handleChange}
        className={cn("h-9 w-full px-9 py-0")}
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
          "!absolute right-0.5 top-[0.2rem] hidden text-muted-foreground hover:text-primary",
          inputValue?.length > 0 && "block",
        )}
        onClick={reset}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
};
