import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
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
  signal?.throwIfAborted();
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
            : "Image upload failed. Try again.",
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
type UploadJob = {
  editor: Editor;
  file: File;
  src: string;
  limit: () => number;
  controller?: AbortController;
  error?: string;
};
const jobs = new Map<string, UploadJob>();
const queue: UploadJob[] = [];
let running = 0;

export function prepareImageUpload(
  editor: Editor,
  file: File,
  limit: () => number,
) {
  const job = { editor, file, src: URL.createObjectURL(file), limit };
  jobs.set(job.src, job);
  // The insertion command dispatches synchronously. Wait until its transaction
  // has landed before looking up the placeholder or starting any network work.
  queueMicrotask(() => {
    if (imagePosition(job) === undefined) forgetUpload(job);
    else schedule(job);
  });
  return job.src;
}
function imagePosition({ editor, src }: UploadJob) {
  let position: number | undefined;
  if (!editor.isDestroyed)
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "image" && node.attrs.src === src) position = pos;
    });
  return position;
}
function forgetUpload(job: UploadJob) {
  if (!jobs.delete(job.src)) return;
  job.controller?.abort();
  const index = queue.indexOf(job);
  if (index !== -1) queue.splice(index, 1);
  URL.revokeObjectURL(job.src);
}
export function reconcileUploads(editor: Editor, destroyed = false) {
  const missing = new Set(
    [...jobs.values()].filter((job) => job.editor === editor),
  );
  if (!missing.size) return;
  if (!destroyed)
    editor.state.doc.descendants((node) => {
      const job = node.type.name === "image" && jobs.get(node.attrs.src);
      if (job) missing.delete(job);
    });
  for (const job of missing) forgetUpload(job);
}
// Undoing the removal of a canceled or failed upload cannot restore its File.
// Drop those transient nodes in the same editor update, before forms see them.
export function removeAbandonedUploads(tr: Transaction) {
  const abandoned: number[] = [];
  tr.doc.descendants((node, pos) => {
    if (
      node.type.name === "image" &&
      typeof node.attrs.src === "string" &&
      node.attrs.src.startsWith("blob:") &&
      !jobs.has(node.attrs.src)
    )
      abandoned.push(pos);
  });
  if (!abandoned.length) return null;
  for (const pos of abandoned.reverse()) tr.delete(pos, pos + 1);
  return tr.setMeta("addToHistory", false);
}
function updatePlaceholder(
  job: UploadJob,
  attributes: Record<string, unknown>,
) {
  const pos = imagePosition(job);
  if (pos === undefined) return;
  const { editor } = job;
  // Attribute steps leave document positions intact for undo/redo, even if the
  // user has typed elsewhere since inserting the placeholder.
  const tr = editor.state.tr;
  for (const [name, value] of Object.entries(attributes)) {
    tr.setNodeAttribute(pos, name, value);
  }
  editor.view.dispatch(tr.setMeta("addToHistory", false));
}
export function retryUpload(src: string) {
  const job = jobs.get(src);
  if (!job?.error || imagePosition(job) === undefined) return;
  job.error = undefined;
  updatePlaceholder(job, { uploadError: null });
  schedule(job);
}
function schedule(job: UploadJob) {
  if (!jobs.has(job.src)) return;
  queue.push(job);
  drainQueue();
}
function drainQueue() {
  while (running < 2 && queue.length) {
    const job = queue.shift()!;
    running++;
    void runUpload(job).finally(() => {
      running--;
      drainQueue();
    });
  }
}
async function runUpload(job: UploadJob) {
  const controller = new AbortController();
  job.controller = controller;
  try {
    const image = await uploadEditorImage(
      job.file,
      job.limit(),
      controller.signal,
    );
    if (controller.signal.aborted) return;
    // Undo removes the inserted image. Redo then carries the permanent
    // attributes, never an already-revoked object URL.
    updatePlaceholder(job, { ...image, uploadError: null });
  } catch (error) {
    if (controller.signal.aborted || !jobs.has(job.src)) return;
    job.error = error instanceof Error ? error.message : "Image upload failed.";
    updatePlaceholder(job, { uploadError: job.error });
  }
}
