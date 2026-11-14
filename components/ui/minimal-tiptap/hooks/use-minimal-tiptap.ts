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
  setImageUploadLimit,
  HorizontalRule,
  CodeBlockLowlight,
  Selection,
  Color,
  UnsetAllMarks,
  ResetMarksOnEnter,
  FileHandler,
} from "../extensions";
import { cn } from "@/lib/utils";
import { getOutput } from "../utils";
import { useThrottle } from "../hooks/use-throttle";
import { toast } from "sonner";
import { useCallback, useLayoutEffect } from "react";
import { MAX_SOURCE_BYTES } from "../upload";
import { useSettings } from "@/hooks/use-settings";
import DOMPurify from "dompurify";

export interface UseMinimalTiptapEditorProps extends UseEditorOptions {
  ariaLabel?: string;
  value?: Content;
  output?: "html" | "json" | "text";
  placeholder?: string;
  editorClassName?: string;
  throttleDelay?: number;
  onUpdate?: (content: Content) => void;
  onBlur?: (content: Content) => void;
  onCreate?: () => void;
}

const createExtensions = (placeholder: string, maxImageBytes: number) => [
  StarterKit.configure({
    // Turned off because this list registers its own version of each below.
    // StarterKit bundles Link and Underline (see its dependencies), so leaving
    // them on registered `link` and `underline` twice — Tiptap warns about the
    // duplicate names, and which copy wins is not defined. That matters for
    // Link in particular: ours drops `javascript:` hrefs in `parseHTML` and adds
    // the click/Escape plugins the link bubble menu relies on.
    horizontalRule: false,
    codeBlock: false,
    link: false,
    underline: false,
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
    maxFileSize: MAX_SOURCE_BYTES,
    allowBase64: false,
    HTMLAttributes: {
      class: "tiptap-image",
    },

    maxImageBytes,
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
    allowedMimeTypes: ["image/*"],
    maxFileSize: MAX_SOURCE_BYTES,
    onDrop: (editor, files, pos) => editor.commands.setImages(files, pos),
    onPaste: (editor, files, slice, text) =>
      editor
        .chain()
        .command(({ tr }) => {
          // Keep ProseMirror's sanitized clipboard content and its files in one
          // editor update and one undo event.
          if (slice.size) tr.replaceSelection(slice);
          else if (text) tr.insertText(text);
          tr.setMeta("paste", true).setMeta("uiEvent", "paste");
          return true;
        })
        .setImages(files)
        .run(),
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
    // Intentionally keep `includeChildren` at its default (`false`).
    // Setting it to true forces the Placeholder extension into a
    // viewport-scan code path that depends on a `scroll` event firing
    // before the decoration is applied to a freshly-mounted empty
    // editor — which made the placeholder only appear after the user
    // scrolled. The default path resolves the empty node directly from
    // the selection anchor and renders the placeholder on first paint.
  }),
];

export const useMinimalTiptapEditor = ({
  value,
  ariaLabel,
  output = "html",
  placeholder = "",
  editorClassName,
  throttleDelay = 0,
  onUpdate,
  onBlur,
  onCreate,
  ...props
}: UseMinimalTiptapEditorProps) => {
  const { capabilities } = useSettings();
  const throttledSetValue = useThrottle(
    (value: Content) => onUpdate?.(value),
    throttleDelay,
  );

  const handleUpdate = useCallback(
    (editor: Editor) =>
      throttleDelay
        ? throttledSetValue(getOutput(editor, output))
        : onUpdate?.(getOutput(editor, output)),
    [output, throttledSetValue, throttleDelay, onUpdate],
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
    extensions: createExtensions(placeholder, capabilities.maxImageBytes),
    editorProps: {
      transformPastedHTML(dirtyHtml) {
        return DOMPurify.sanitize(dirtyHtml, {
          FORBID_TAGS: ["img", "picture", "source"],
          FORBID_ATTR: ["class", "style"],
        }).trim();
      },
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
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

  useLayoutEffect(() => {
    if (editor) setImageUploadLimit(editor, capabilities.maxImageBytes);
  }, [editor, capabilities.maxImageBytes]);
  return editor;
};

export default useMinimalTiptapEditor;
