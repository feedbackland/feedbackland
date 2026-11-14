import { copyText, copyImage as copyImageBlob } from "@/lib/copy-text";
import type { ImageOptions } from "@tiptap/extension-image";
import { clientRuntime } from "@/lib/client-runtime";
import { Image as TiptapImage } from "@tiptap/extension-image";
import type { Editor } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageViewBlock } from "./components/image-view-block";
import {
  filterFiles,
  type FileError,
  type FileValidationOptions,
} from "../../utils";
import { closeHistory } from "@tiptap/pm/history";
import { Plugin } from "@tiptap/pm/state";
import {
  prepareImageUpload,
  reconcileUploads,
  removeAbandonedUploads,
} from "../../upload";
import type { Attrs } from "@tiptap/pm/model";

type ImageAction = "download" | "copyImage" | "copyLink";

interface DownloadImageCommandProps {
  src: string;
  alt?: string;
}

interface ImageActionProps extends DownloadImageCommandProps {
  action: ImageAction;
}

interface CustomImageOptions extends ImageOptions, FileValidationOptions {
  onImageRemoved?: (props: Attrs) => void;
  onActionSuccess?: (props: ImageActionProps) => void;
  onActionError?: (error: Error, props: ImageActionProps) => void;
  downloadImage?: (
    props: ImageActionProps,
    options: CustomImageOptions,
  ) => Promise<void>;
  copyImage?: (
    props: ImageActionProps,
    options: CustomImageOptions,
  ) => Promise<void>;
  copyLink?: (
    props: ImageActionProps,
    options: CustomImageOptions,
  ) => Promise<void>;
  onValidationError?: (errors: FileError[]) => void;
  maxImageBytes: number;
}

// Extension storage belongs to Tiptap and persists for the life of the editor.
export function setImageUploadLimit(editor: Editor, maxImageBytes: number) {
  editor.storage.image.maxImageBytes = maxImageBytes;
}

declare module "@tiptap/core" {
  interface Storage {
    image: { maxImageBytes: number };
  }
}

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    setImages: {
      setImages: (files: File[], pos?: number) => ReturnType;
    };
    downloadImage: {
      downloadImage: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    copyImage: {
      copyImage: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    copyLink: {
      copyLink: (attrs: DownloadImageCommandProps) => ReturnType;
    };
    toggleImage: {
      toggleImage: () => ReturnType;
    };
  }
}

const handleError = (
  error: unknown,
  props: ImageActionProps,
  errorHandler?: (error: Error, props: ImageActionProps) => void,
): void => {
  const typedError =
    error instanceof Error ? error : new Error("Unknown error");
  errorHandler?.(typedError, props);
};

const fetchImageBlob = async (
  src: string,
): Promise<{ blob: Blob; extension: string }> => {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Failed to fetch image");
  const blob = await response.blob();
  const extension = blob.type.split(/\/|\+/)[1];
  return { blob, extension };
};

const saveImage = async (
  blob: Blob,
  name: string,
  extension: string,
): Promise<void> => {
  const imageURL = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = imageURL;
  link.download = `${name}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(imageURL);
};

const downloadImage = async (
  props: ImageActionProps,
  options: CustomImageOptions,
): Promise<void> => {
  const { src, alt } = props;
  const potentialName = alt || "image";

  try {
    const { blob, extension } = await fetchImageBlob(src);
    await saveImage(blob, potentialName, extension);
    options.onActionSuccess?.({ ...props, action: "download" });
  } catch (error) {
    handleError(error, { ...props, action: "download" }, options.onActionError);
  }
};

const copyImage = async (
  props: ImageActionProps,
  options: CustomImageOptions,
): Promise<void> => {
  const { src } = props;
  try {
    if (!(await copyImageBlob(async () => (await fetchImageBlob(src)).blob)))
      throw new Error("Image copying is unavailable in this browser.");
    options.onActionSuccess?.({ ...props, action: "copyImage" });
  } catch (error) {
    handleError(
      error,
      { ...props, action: "copyImage" },
      options.onActionError,
    );
  }
};

const copyLink = async (
  props: ImageActionProps,
  options: CustomImageOptions,
): Promise<void> => {
  const { src } = props;
  try {
    if (!clientRuntime.appUrl)
      throw new Error("The public app URL is unavailable");
    const copied = await copyText(
      new URL(src, clientRuntime.appUrl).toString(),
    );
    if (!copied) return;
    options.onActionSuccess?.({ ...props, action: "copyLink" });
  } catch (error) {
    handleError(error, { ...props, action: "copyLink" }, options.onActionError);
  }
};

export const Image = TiptapImage.extend<
  CustomImageOptions,
  { maxImageBytes: number }
>({
  atom: true,

  addOptions() {
    return {
      ...this.parent?.(),
      allowedMimeTypes: [],
      maxFileSize: 0,
      maxImageBytes: 0,

      downloadImage: undefined,
      copyImage: undefined,
      copyLink: undefined,
    } as CustomImageOptions;
  },

  addStorage() {
    return { maxImageBytes: this.options.maxImageBytes };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      id: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      uploadError: { default: null, rendered: false },
      fileName: {
        default: null,
      },
    };
  },

  addCommands() {
    return {
      setImages:
        (files, pos) =>
        ({ editor, tr, commands, dispatch }) => {
          const [valid, errors] = filterFiles(files, this.options);
          if (dispatch && errors.length)
            this.options.onValidationError?.(errors);
          if (!valid.length || !dispatch) return valid.length > 0;
          closeHistory(tr);
          return commands.insertContentAt(
            pos ?? { from: tr.selection.from, to: tr.selection.to },
            valid.map((file) => ({
              type: "image",
              attrs: {
                src: prepareImageUpload(
                  editor,
                  file,
                  () => editor.storage.image.maxImageBytes,
                ),
              },
            })),
          );
        },
      downloadImage: (attrs) => () => {
        const downloadFunc = this.options.downloadImage || downloadImage;
        void downloadFunc({ ...attrs, action: "download" }, this.options);
        return true;
      },

      copyImage: (attrs) => () => {
        const copyImageFunc = this.options.copyImage || copyImage;
        void copyImageFunc({ ...attrs, action: "copyImage" }, this.options);
        return true;
      },

      copyLink: (attrs) => () => {
        const copyLinkFunc = this.options.copyLink || copyLink;
        void copyLinkFunc({ ...attrs, action: "copyLink" }, this.options);
        return true;
      },

      toggleImage:
        () =>
        ({ editor }) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = this.options.allowedMimeTypes.join(",");
          input.onchange = () => {
            const files = input.files;
            if (!files) return;

            editor.commands.setImages(Array.from(files));
          };

          input.click();
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.docChanged)
            ? removeAbandonedUploads(state.tr)
            : null,
      }),
    ];
  },
  onTransaction({ editor, transaction }) {
    if (transaction.docChanged) reconcileUploads(editor);
  },
  onDestroy() {
    reconcileUploads(this.editor, true);
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageViewBlock, {
      className: "block-node",
    });
  },
});
