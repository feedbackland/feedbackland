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
import { useEffect } from "react";

export interface MinimalTiptapProps extends Omit<
  UseMinimalTiptapEditorProps,
  "onUpdate"
> {
  value?: Content;
  onChange?: (value: Content) => void;
  className?: string;
  editorContentClassName?: string;
  showToolbar?: boolean;
  disabled?: boolean;
}

const Toolbar = ({
  editor,
  hide = false,
  disabled = false,
}: {
  editor: Editor;
  hide?: boolean;
  disabled?: boolean;
}) => (
  <div className={cn("flex h-12 items-center px-2", hide && "hidden")}>
    <ImageSelectBlock editor={editor} disabled={disabled} />
  </div>
);

export const MinimalTiptapEditor = ({
  value,
  onChange,
  className,
  editorContentClassName,
  showToolbar = false,
  disabled = false,
  ...props
}: MinimalTiptapProps) => {
  const isDisabled = !!(props.editable === false || disabled);

  const editor = useMinimalTiptapEditor({
    value,
    onUpdate: onChange,
    ...props,
    editable: !isDisabled,
  });

  useEffect(() => {
    if (!editor) return;

    if (value === "" || !value) {
      editor.commands.clearContent();
      return;
    }

    // Only set content when the value differs from what the editor currently has.
    // This prevents infinite loops when the editor's own onChange triggers a re-render
    // (in that case, the value prop matches the editor's HTML output exactly).
    const currentHTML = editor.getHTML();
    if (value !== currentHTML) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const handleOnClick = () => {
    editor?.commands.focus();
  };

  if (!editor) {
    // Render a static mirror of Tiptap's empty-editor DOM so the placeholder
    // is visible from the first paint. Without this the component returns
    // null until `useEditor` finishes initializing post-hydration
    // (immediatelyRender: false is required for SSR), leaving a blank hole
    // that only filled in after the user moved/scrolled.
    return (
      <div
        className={cn(
          "border-input dark:bg-input/30 flex w-full cursor-text flex-col rounded-md border shadow-xs",
          isDisabled && "cursor-not-allowed",
          className,
        )}
        aria-busy="true"
      >
        <div className={cn("minimal-tiptap-editor", editorContentClassName)}>
          <div className={cn("ProseMirror", props.editorClassName)}>
            <p
              className="text-node is-editor-empty"
              data-placeholder={props.placeholder ?? ""}
            >
              <br />
            </p>
          </div>
        </div>
        {showToolbar && <div className="flex h-12 items-center px-2" />}
      </div>
    );
  }

  return (
    <MeasuredContainer
      as="div"
      name="editor"
      className={cn(
        "border-input dark:bg-input/30 flex w-full cursor-text flex-col rounded-md border shadow-xs",
        isDisabled && "cursor-not-allowed",
        className,
      )}
      onClick={handleOnClick}
    >
      <EditorContent
        editor={editor}
        className={cn("minimal-tiptap-editor", editorContentClassName)}
        onClick={handleOnClick}
      />
      <Toolbar editor={editor} hide={!showToolbar} disabled={disabled} />
      <LinkBubbleMenu editor={editor} />
    </MeasuredContainer>
  );
};

MinimalTiptapEditor.displayName = "MinimalTiptapEditor";

export default MinimalTiptapEditor;
