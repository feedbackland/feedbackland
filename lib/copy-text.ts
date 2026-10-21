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

export async function copyImage(blob: Blob): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === "undefined"
  )
    return false;
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  return true;
}
