import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";

interface InputProps {
  onDebouncedChange: (value: string) => void;
  delay?: number; // Optional delay in milliseconds (default: 500ms)
}

export const SearchInput: React.FC<InputProps> = ({
  onDebouncedChange,
  delay = 500,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");

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

  return (
    <div className="flex w-full max-w-sm items-center rounded-lg border border-gray-300 px-2.5 py-1.5">
      <SearchIcon className="mr-2 size-4" />
      <Input
        type="text"
        placeholder="Search..."
        value={inputValue}
        onChange={handleChange}
        className="w-full border-0"
      />
    </div>
  );
};
