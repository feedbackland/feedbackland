"use client";

/** Returns true only when copying completed. The manual fallback stays visible
 * with the value selected, and returns false so callers do not claim success. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Try the plain-HTTP fallback. */
    }
  }
  const previous = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.setAttribute("aria-label", "Text to copy");
  field.style.cssText = "position:fixed;left:-10000px;top:0";
  document.body.append(field);
  field.focus({ preventScroll: true });
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    /* Show the selectable value. */
  }
  field.remove();
  if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  if (copied) return true;
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", "Copy text manually");
  const label = document.createElement("p");
  label.textContent =
    "Copy the selected text using your device’s copy command.";
  field.style.cssText =
    "display:block;min-width:20rem;max-width:80vw;min-height:8rem";
  const close = document.createElement("button");
  close.textContent = "Close";
  close.onclick = () => dialog.close();
  dialog.onclose = () => {
    dialog.remove();
    if (previous instanceof HTMLElement)
      previous.focus({ preventScroll: true });
  };
  dialog.append(label, field, close);
  document.body.append(dialog);
  dialog.showModal();
  field.focus();
  field.select();
  return false;
}

export function canCopyImage() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined" &&
    (typeof ClipboardItem.supports !== "function" ||
      ClipboardItem.supports("image/png"))
  );
}

async function clipboardPng(blob: Blob) {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image copying is unavailable.");
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (png) =>
          png ? resolve(png) : reject(new Error("Could not copy the image.")),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}

export async function copyImage(load: () => Promise<Blob>): Promise<boolean> {
  if (!canCopyImage()) return false;
  // Initiate the clipboard write inside the click, even if fetching or converting
  // the image finishes after the browser's transient user activation has expired.
  const png = load().then(clipboardPng);
  void png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  return true;
}
