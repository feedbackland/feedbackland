import * as React from "react";
import "../minimal-tiptap/styles/index.css";

import type { Content, Editor } from "@tiptap/react";
import type { UseMinimalTiptapEditorProps } from "./hooks/use-minimal-tiptap";
import { EditorContent } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { ImageSelectBlock } from "./components/image/image-select-block";
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu";
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap";
import { MeasuredContainer } from "../minimal-tiptap/components/measured-container";

export interface MinimalTiptapProps
  extends Omit<UseMinimalTiptapEditorProps, "onUpdate"> {
  value?: Content;
  onChange?: (value: Content) => void;
  className?: string;
  editorContentClassName?: string;
  showToolbar?: boolean;
}

const Toolbar = ({
  editor,
  hide = false,
}: {
  editor: Editor;
  hide?: boolean;
}) => (
  <div className={cn("flex h-12 items-center px-2", hide && "hidden")}>
    <ImageSelectBlock editor={editor} />
  </div>
);

export const MinimalTiptapEditor = React.forwardRef<
  HTMLDivElement,
  MinimalTiptapProps
>(
  (
    {
      value,
      onChange,
      className,
      editorContentClassName,
      showToolbar = false,
      ...props
    },
    ref,
  ) => {
    const editor = useMinimalTiptapEditor({
      value,
      onUpdate: onChange,
      ...props,
    });

    React.useEffect(() => {
      if (value === "") {
        editor?.commands.setContent("");
      }
    }, [value, editor]);

    if (!editor) {
      return null;
    }

    return (
      <MeasuredContainer
        as="div"
        name="editor"
        ref={ref}
        className={cn(
          "flex h-full w-full flex-col rounded-md border border-input shadow-sm",
          className,
        )}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "minimal-tiptap-editor h-full flex-1",
            editorContentClassName,
          )}
        />
        <Toolbar editor={editor} hide={!showToolbar} />
        <LinkBubbleMenu editor={editor} />
      </MeasuredContainer>
    );
  },
);

MinimalTiptapEditor.displayName = "MinimalTiptapEditor";

export default MinimalTiptapEditor;
