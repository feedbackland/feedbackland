"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import { Toolbar } from "./toolbar";

export function Tiptap2({
  description,
  onChange,
}: {
  description: string;
  onChange: (richText: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Heading.configure({
        HTMLAttributes: {
          class: "text-xl font-bold",
          levels: [2],
        },
      }),
    ],
    content: description,
    editorProps: {
      attributes: {
        class:
          "rounded-md border min-h-[150px] border-input bg-background focus:ring-offset-2 disabled:cursor-not-allows disabled:opacity-50 p-2",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      console.log(editor.getHTML());
    },
  });

  return (
    <div className="flex min-h-[250px] flex-col">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
