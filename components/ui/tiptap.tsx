import { useState } from "react";
import { Content } from "@tiptap/react";
import { MinimalTiptapEditor } from "./minimal-tiptap";

export const Tiptap = ({
  placeholder,
  onChange,
}: {
  placeholder: string;
  onChange: (value: string) => void;
}) => {
  const [value, setValue] = useState<Content>("");

  const handleChange = (value: Content) => {
    setValue(value);
    onChange(value as string);
  };

  return (
    <MinimalTiptapEditor
      value={value}
      onChange={handleChange}
      className="min-h-20 w-full bg-background"
      editorContentClassName="p-2.5 text-sm"
      editorClassName="focus:outline-none"
      output="html"
      placeholder={placeholder}
      autofocus={false}
      editable={true}
    />
  );
};
