import { Content } from "@tiptap/react";
import { MinimalTiptapEditor } from "./minimal-tiptap";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Tiptap = ({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  onCreate,
  className,
  showToolbar = true,
  autofocus = false,
}: {
  value: Content;
  placeholder?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onCreate?: () => void;
  className?: React.ComponentProps<"div">["className"];
  showToolbar?: boolean;
  autofocus?: boolean;
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (value: Content) => {
    onChange(value as string);
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <MinimalTiptapEditor
      value={value}
      className={cn(
        "rounded-lg shadow-sm",
        isFocused && "ring-ring ring-1",
        className,
      )}
      editorContentClassName="text-sm leading-5 p-3"
      editorClassName="focus:outline-hidden"
      output="html"
      placeholder={placeholder}
      autofocus={!!autofocus}
      editable={true}
      showToolbar={showToolbar}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onCreate={onCreate}
    />
  );
};
