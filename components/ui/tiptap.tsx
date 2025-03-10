import { Content } from "@tiptap/react";
import { MinimalTiptapEditor } from "./minimal-tiptap";

export const Tiptap = ({
  value,
  placeholder,
  onChange,
}: {
  value: Content;
  placeholder: string;
  onChange: (value: string) => void;
}) => {
  const handleChange = (value: Content) => {
    onChange(value as string);
  };

  return (
    <MinimalTiptapEditor
      value={value}
      onChange={handleChange}
      className="min-h-20 bg-background shadow-none"
      editorContentClassName="p-0 text-sm leading-5 h-full p-4"
      editorClassName="focus:outline-none"
      output="html"
      placeholder={placeholder}
      autofocus={true}
      editable={true}
    />
  );
};
