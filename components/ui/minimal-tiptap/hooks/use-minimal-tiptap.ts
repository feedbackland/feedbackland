import type { Editor } from "@tiptap/react";
import type { Content, UseEditorOptions } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEditor } from "@tiptap/react";
import { Typography } from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Mention } from "@tiptap/extension-mention";
import { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance, Props as TippyProps } from "tippy.js";
import MentionList from "@/components/ui/minimal-tiptap/components/mention-list";
import {
  Link,
  Image,
  HorizontalRule,
  CodeBlockLowlight,
  Selection,
  Color,
  UnsetAllMarks,
  ResetMarksOnEnter,
  FileHandler,
} from "../extensions";
import { cn } from "@/lib/utils";
import { fileToBase64, getOutput, randomId } from "../utils";
import { useThrottle } from "../hooks/use-throttle";
import { toast } from "sonner";
import { useCallback } from "react";
import DOMPurify from "dompurify";

export interface UseMinimalTiptapEditorProps extends UseEditorOptions {
  value?: Content;
  output?: "html" | "json" | "text";
  placeholder?: string;
  editorClassName?: string;
  throttleDelay?: number;
  onUpdate?: (content: Content) => void;
  onBlur?: (content: Content) => void;
  onCreate?: () => void;
}

const createExtensions = (placeholder: string) => [
  StarterKit.configure({
    horizontalRule: false,
    codeBlock: false,
    paragraph: { HTMLAttributes: { class: "text-node" } },
    heading: { HTMLAttributes: { class: "heading-node" } },
    blockquote: { HTMLAttributes: { class: "block-node" } },
    bulletList: { HTMLAttributes: { class: "list-node" } },
    orderedList: { HTMLAttributes: { class: "list-node" } },
    code: { HTMLAttributes: { class: "inline", spellcheck: "false" } },
    dropcursor: { width: 2, class: "ProseMirror-dropcursor border" },
  }),
  Link.configure({
    // Automatically add links when URL-like text is typed or pasted.
    autolink: true,

    // Keep links when pasting HTML that already contains links. Default: true
    linkOnPaste: true,

    // Make links clickable. Default: true
    openOnClick: true,

    // Add HTML attributes to the generated <a> tags
    HTMLAttributes: {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    },
  }),
  Underline,
  Image.configure({
    allowedMimeTypes: ["image/*"],
    maxFileSize: 5 * 1024 * 1024,
    allowBase64: true,
    HTMLAttributes: {
      class: "tiptap-image",
    },

    onToggle(editor, files, pos) {
      editor.commands.insertContentAt(
        pos,
        files.map((image) => {
          const blobUrl = URL.createObjectURL(image);
          const id = randomId();

          return {
            type: "image",
            attrs: {
              id,
              src: blobUrl,
              alt: image.name,
              title: image.name,
              fileName: image.name,
            },
          };
        }),
      );
    },
    // onImageRemoved({ id, src }) {},
    onValidationError(errors) {
      errors.forEach((error) => {
        toast.error("Image validation error", {
          position: "bottom-right",
          description: error.reason,
        });
      });
    },
    onActionSuccess({ action }) {
      const mapping = {
        copyImage: "Copy Image",
        copyLink: "Copy Link",
        download: "Download",
      };
      toast.success(mapping[action], {
        position: "bottom-right",
        description: "Image action success",
      });
    },
    onActionError(error, { action }) {
      const mapping = {
        copyImage: "Copy Image",
        copyLink: "Copy Link",
        download: "Download",
      };
      toast.error(`Failed to ${mapping[action]}`, {
        position: "bottom-right",
        description: error.message,
      });
    },
  }),
  FileHandler.configure({
    allowBase64: true,
    allowedMimeTypes: ["image/*"],
    maxFileSize: 5 * 1024 * 1024,
    onDrop: async (editor, files, pos) => {
      const insertionPromises = files.map(async (file) => {
        const src = await fileToBase64(file);
        // Insert content at the original drop position for all files
        editor.commands.insertContentAt(pos, {
          type: "image",
          attrs: { src },
        });
      });

      await Promise.all(insertionPromises);

      // After all images are inserted, focus, add a new line, and move cursor to the end
      editor
        .chain()
        .focus()
        .enter() // Add the new paragraph
        .focus() // Re-focus might be needed
        .setTextSelection(editor.state.doc.content.size) // Move cursor to the end
        .run();
    },
    onPaste: async (editor, files) => {
      const insertionPromises = files.map(async (file) => {
        const src = await fileToBase64(file);
        // Insert content at the current cursor position
        editor.commands.insertContent({
          type: "image",
          attrs: { src },
        });
      });

      await Promise.all(insertionPromises);

      // After all images are inserted, focus, add a new line, and move cursor to the end
      editor
        .chain()
        .focus()
        .enter() // Add the new paragraph
        .focus() // Re-focus might be needed
        .setTextSelection(editor.state.doc.content.size) // Move cursor to the end
        .run();
    },
    onValidationError: (errors) => {
      errors.forEach((error) => {
        toast.error("Image validation error", {
          position: "bottom-right",
          description: error.reason,
        });
      });
    },
  }),
  Color,
  TextStyle,
  Selection,
  Typography,
  UnsetAllMarks,
  HorizontalRule,
  ResetMarksOnEnter,
  CodeBlockLowlight,
  Mention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    suggestion: {
      char: "@",
      items: () => [],
      render: () => {
        let component: ReactRenderer<any> | null = null;
        let popup: Instance<TippyProps> | null = null;

        return {
          onStart: (props: SuggestionProps) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) {
              return;
            }

            popup = tippy("body", {
              getReferenceClientRect: props.clientRect as any, // Cast needed for Tippy v6
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
            })[0];
          },

          onUpdate(props: SuggestionProps) {
            component?.updateProps(props);

            if (!props.clientRect) {
              return;
            }

            popup?.setProps({
              getReferenceClientRect: props.clientRect as any,
            });
          },

          onKeyDown(props: SuggestionKeyDownProps) {
            if (props.event.key === "Escape") {
              props.event?.preventDefault();
              props.event?.stopPropagation();
              popup?.hide();
              return true;
            }

            // Pass keydown events to the MentionList component
            return component?.ref?.onKeyDown(props);
          },

          onExit() {
            popup?.destroy();
            component?.destroy();
          },
        };
      },
    },
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "paragraph" && !node.firstChild) {
        // Split placeholder into lines and process each line
        const lines = placeholder.split("\n").map((line) => line.trim());

        // If only one line, return it directly
        if (lines.length === 1) return lines[0];

        // For multiple lines, format with bullets except first line
        return lines
          .filter(Boolean)
          .map((line, index) => (index === 0 ? line : `${line}`))
          .join("\n");
      }

      return "";
    },
    showOnlyWhenEditable: true,
    includeChildren: true,
  }),
];

export const useMinimalTiptapEditor = ({
  value,
  output = "html",
  placeholder = "",
  editorClassName,
  throttleDelay = 0,
  onUpdate,
  onBlur,
  onCreate,
  ...props
}: UseMinimalTiptapEditorProps) => {
  const throttledSetValue = useThrottle(
    (value: Content) => onUpdate?.(value),
    throttleDelay,
  );

  const handleUpdate = useCallback(
    (editor: Editor) => throttledSetValue(getOutput(editor, output)),
    [output, throttledSetValue],
  );

  const handleCreate = useCallback(
    (editor: Editor) => {
      if (value && editor.isEmpty) {
        editor.commands.setContent(value);
      }

      onCreate?.();
    },
    [value, onCreate],
  );

  const handleBlur = useCallback(
    (editor: Editor) => {
      // editor.commands.setTextSelection(editor.state.doc.content.size);
      onBlur?.(getOutput(editor, output));
    },
    [output, onBlur],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createExtensions(placeholder),
    editorProps: {
      transformPastedHTML(dirtyHtml) {
        return DOMPurify.sanitize(dirtyHtml, {
          FORBID_ATTR: ["class", "style"],
        }).trim();
      },
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        class: cn("focus:outline-hidden", editorClassName),
      },
    },
    onUpdate: ({ editor }) => handleUpdate(editor),
    onCreate: ({ editor }) => handleCreate(editor),
    onBlur: ({ editor }) => handleBlur(editor),
    ...props,
  });

  return editor;
};

export default useMinimalTiptapEditor;
