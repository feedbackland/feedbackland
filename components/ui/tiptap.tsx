import { Content } from "@tiptap/react";
import { MinimalTiptapEditor } from "./minimal-tiptap";
import { cn } from "@/lib/utils";

export const Tiptap = ({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  className,
  showToolbar = false,
  autofocus = false,
}: {
  value: Content;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: React.ComponentProps<"div">["className"];
  showToolbar?: boolean;
  autofocus?: boolean;
}) => {
  const handleChange = (value: Content) => {
    onChange(value as string);
  };

  return (
    <MinimalTiptapEditor
      value={value}
      className={cn("h-full rounded-lg shadow-xs", className)}
      editorContentClassName="text-sm leading-5 p-3"
      editorClassName="focus:outline-hidden min-h-[42px]"
      output="html"
      placeholder={placeholder}
      autofocus={!!autofocus}
      editable={true}
      showToolbar={showToolbar}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};
