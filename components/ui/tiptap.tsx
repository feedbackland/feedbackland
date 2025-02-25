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
      className="min-h-11 w-full border-none bg-background shadow-none"
      editorContentClassName="p-0 text-sm leading-5"
      editorClassName="focus:outline-none"
      output="html"
      placeholder={placeholder}
      autofocus={false}
      editable={true}
    />
  );
};
