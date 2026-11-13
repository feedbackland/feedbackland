import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { imageId } from "@/lib/images/path";
import { clientRuntime } from "@/lib/client-runtime";
export const MAX_SOURCE_BYTES = 25_000_000;
export const uploadHelp =
  "Photos are resized in your browser. GIFs and directly uploaded images can retain metadata, including location. Unsent attachments expire after 24 hours and may be reclaimed sooner.";
export const hasPendingUpload = (html: string) =>
  /<img\b[^>]*\bsrc\s*=\s*["']blob:/i.test(html);
export async function checkImageSource(file: File) {
  if (
    !file.type.startsWith("image/") ||
    !file.size ||
    file.size > MAX_SOURCE_BYTES ||
    file.type === "image/svg+xml" ||
    /\.svgz?$/i.test(file.name)
  )
    throw new Error("Choose a raster image up to 25 MB.");
  const prefix = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (/^\s*(?:<|\uFEFF<)/.test(new TextDecoder().decode(prefix)))
    throw new Error("Vector images are unsupported.");
  return /^GIF8[79]a/.test(String.fromCharCode(...prefix.subarray(0, 6)));
}
export async function uploadEditorImage(
  file: File,
  maxBytes: number,
  signal?: AbortSignal,
) {
  if (clientRuntime.mutationsBlocked)
    throw new Error("Reload the board before uploading.");
  const gif = await checkImageSource(file);
  let blob: Blob = file;
  if (!gif) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      throw new Error("This browser could not decode the image.");
    }
    try {
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image processing is unavailable.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const type =
        file.type === "image/png"
          ? "image/png"
          : file.type === "image/webp"
            ? "image/webp"
            : "image/jpeg";
      if (type === "image/jpeg") {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Image encoding failed.")),
          type,
          0.85,
        ),
      );
      if (
        blob.type !== type &&
        !(type === "image/webp" && blob.type === "image/png")
      )
        throw new Error("This browser could not encode the selected image.");
    } finally {
      bitmap.close();
    }
  }
  if (blob.size > maxBytes)
    throw new Error("The encoded image exceeds the board’s upload limit.");
  signal?.throwIfAborted();
  const data = new FormData();
  data.append("file", blob, "attachment");
  const response = await fetch("/api/images", {
    method: "POST",
    credentials: "omit",
    body: data,
    signal,
  });
  if (!response.ok)
    throw new Error(
      response.status === 507
        ? "Image storage is full. Contact an administrator."
        : response.status === 429
          ? "The upload limit was reached. Try again shortly."
          : response.status === 415
            ? "This image format or animation is unsupported."
            : "Image upload failed. Re-attach the image and try again.",
    );
  const result = await response.json();
  if (
    !result ||
    typeof result.id !== "string" ||
    typeof result.url !== "string" ||
    imageId(result.url) !== result.id ||
    !Number.isInteger(result.width) ||
    !Number.isInteger(result.height) ||
    result.width < 1 ||
    result.height < 1 ||
    result.width > 10000 ||
    result.height > 10000
  )
    throw new Error("Invalid upload response.");
  return {
    id: String(result.id),
    src: String(result.url),
    width: Number(result.width),
    height: Number(result.height),
  };
}
export function insertImages(
  editor: Editor,
  files: File[],
  pos: number,
  maxBytes: number,
) {
  const entries = files.map((file) => ({
    file,
    src: URL.createObjectURL(file),
  }));
  const inserted = editor.commands.insertContentAt(
    pos,
    entries.map(({ src }) => ({ type: "image", attrs: { src } })),
  );
  for (const { file, src } of entries) {
    const controller = new AbortController();
    const stop = () => controller.abort();
    const position = () => {
      let found: number | undefined;
      if (!editor.isDestroyed)
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === src) found = pos;
        });
      return found;
    };
    const removed = () => {
      if (position() === undefined) stop();
    };
    if (!inserted) {
      URL.revokeObjectURL(src);
      continue;
    }
    editor.on("destroy", stop);
    editor.on("transaction", removed);
    void uploadEditorImage(file, maxBytes, controller.signal)
      .then((image) => {
        const pos = position();
        if (pos !== undefined && !controller.signal.aborted)
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, image),
          );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const pos = position();
        if (pos !== undefined)
          editor.view.dispatch(editor.state.tr.delete(pos, pos + 1));
        toast.error(
          error instanceof Error ? error.message : "Image upload failed.",
        );
      })
      .finally(() => {
        editor.off("destroy", stop);
        editor.off("transaction", removed);
        URL.revokeObjectURL(src);
      });
  }
}
