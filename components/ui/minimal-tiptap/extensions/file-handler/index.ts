import { type Editor, Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Slice } from "@tiptap/pm/model";
import type { FileError, FileValidationOptions } from "../../utils";
import { filterFiles } from "../../utils";

type FileHandlePluginOptions = {
  key?: PluginKey;
  editor: Editor;
  onPaste?: (editor: Editor, files: File[], slice: Slice, text: string) => void;
  onDrop?: (editor: Editor, files: File[], pos: number) => void;
  onValidationError?: (errors: FileError[]) => void;
} & FileValidationOptions;

const FileHandlePlugin = (options: FileHandlePluginOptions) => {
  const {
    key,
    editor,
    onPaste,
    onDrop,
    onValidationError,
    allowedMimeTypes,
    maxFileSize,
  } = options;

  return new Plugin({
    key: key || new PluginKey("fileHandler"),

    props: {
      handleDrop(view, event) {
        const { dataTransfer } = event;

        if (!dataTransfer?.files.length) {
          return;
        }

        const pos = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        event.preventDefault();
        event.stopPropagation();
        const [validFiles, errors] = filterFiles(
          Array.from(dataTransfer.files),
          {
            allowedMimeTypes,
            maxFileSize,
          },
        );

        if (errors.length > 0 && onValidationError) {
          onValidationError(errors);
        }

        if (validFiles.length > 0 && onDrop) {
          onDrop(editor, validFiles, pos?.pos ?? 0);
        }
        return true;
      },

      handlePaste(_view, event, slice) {
        const { clipboardData } = event;

        if (!clipboardData?.files.length) {
          return;
        }

        const [validFiles, errors] = filterFiles(
          Array.from(clipboardData.files),
          {
            allowedMimeTypes,
            maxFileSize,
          },
        );

        if (errors.length > 0 && onValidationError) {
          onValidationError(errors);
        }

        if (!validFiles.length || !onPaste) return false;
        onPaste(editor, validFiles, slice, clipboardData.getData("text/plain"));
        return true;
      },
    },
  });
};

export const FileHandler = Extension.create<
  Omit<FileHandlePluginOptions, "key" | "editor">
>({
  name: "fileHandler",

  addOptions() {
    return {
      allowedMimeTypes: [],
      maxFileSize: 0,
    };
  },

  addProseMirrorPlugins() {
    return [
      FileHandlePlugin({
        key: new PluginKey(this.name),
        editor: this.editor,
        ...this.options,
      }),
    ];
  },
});
