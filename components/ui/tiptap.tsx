import { Content } from "@tiptap/react";
// import { MinimalTiptapEditor } from "./minimal-tiptap";
import { cn } from "@/lib/utils";
import { useState } from "react";
import dynamic from "next/dynamic";

const MinimalTiptapEditor = dynamic(
  () =>
    import("./minimal-tiptap").then(
      ({ MinimalTiptapEditor }) => MinimalTiptapEditor,
    ),
  {
    loading: () => (
      <div className="border-input dark:bg-input/30 bg-input/30 h-[93px] w-full rounded-lg border shadow-xs" />
    ),
    ssr: false,
  },
);

export const Tiptap = ({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  onCreate,
  className,
  editorContentClassName,
  editorClassName,
  showToolbar = true,
  autofocus = false,
  disabled = false,
}: {
  value: Content;
  placeholder?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onCreate?: () => void;
  className?: React.ComponentProps<"div">["className"];
  editorContentClassName?: React.ComponentProps<"div">["className"];
  editorClassName?: React.ComponentProps<"div">["className"];
  showToolbar?: boolean;
  autofocus?: boolean;
  disabled?: boolean;
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
        "bg-input/30 rounded-lg",
        isFocused && "ring-ring ring-1",
        className,
      )}
      editorContentClassName={cn(
        "text-sm leading-5 p-3",
        editorContentClassName,
      )}
      editorClassName={cn("focus:outline-hidden", editorClassName)}
      output="html"
      placeholder={placeholder}
      autofocus={!!autofocus}
      editable={true}
      showToolbar={showToolbar}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onCreate={onCreate}
      disabled={disabled}
    />
  );
};
