import type { Editor } from "@tiptap/react";
import type { MinimalTiptapProps } from "./minimal-tiptap";

type ShortcutKeyResult = {
  symbol: string;
  readable: string;
};

export type FileError = {
  file: File;
  reason: "type" | "size";
};

export type FileValidationOptions = {
  allowedMimeTypes: string[];
  maxFileSize?: number;
};

export const isClient = (): boolean => typeof window !== "undefined";
export const isServer = (): boolean => !isClient();
export const isMacOS = (): boolean =>
  isClient() && window.navigator.platform === "MacIntel";

const shortcutKeyMap: Record<string, ShortcutKeyResult> = {
  mod: isMacOS()
    ? { symbol: "⌘", readable: "Command" }
    : { symbol: "Ctrl", readable: "Control" },
  alt: isMacOS()
    ? { symbol: "⌥", readable: "Option" }
    : { symbol: "Alt", readable: "Alt" },
  shift: { symbol: "⇧", readable: "Shift" },
};

export const getShortcutKey = (key: string): ShortcutKeyResult =>
  shortcutKeyMap[key.toLowerCase()] || { symbol: key, readable: key };

export const getShortcutKeys = (keys: string[]): ShortcutKeyResult[] =>
  keys.map(getShortcutKey);

export const getOutput = (
  editor: Editor,
  format: MinimalTiptapProps["output"],
): object | string => {
  switch (format) {
    case "json":
      return editor.getJSON();
    case "html":
      return editor.isEmpty ? "" : editor.getHTML();
    default:
      return editor.getText();
  }
};

export const isUrl = (
  text: string,
  options: { requireHostname: boolean; allowBase64?: boolean } = {
    requireHostname: false,
  },
): boolean => {
  if (text.includes("\n")) return false;

  try {
    const url = new URL(text);
    const blockedProtocols = [
      "javascript:",
      "file:",
      "vbscript:",
      ...(options.allowBase64 ? [] : ["data:"]),
    ];

    if (blockedProtocols.includes(url.protocol)) return false;
    if (options.allowBase64 && url.protocol === "data:")
      return /^data:image\/[a-z]+;base64,/.test(text);
    if (url.hostname) return true;

    return (
      url.protocol !== "" &&
      (url.pathname.startsWith("//") || url.pathname.startsWith("http")) &&
      !options.requireHostname
    );
  } catch {
    return false;
  }
};

export const sanitizeUrl = (
  url: string | null | undefined,
  options: { allowBase64?: boolean } = {},
): string | undefined => {
  if (!url) return undefined;

  if (options.allowBase64 && url.startsWith("data:image")) {
    return isUrl(url, { requireHostname: false, allowBase64: true })
      ? url
      : undefined;
  }

  return isUrl(url, {
    requireHostname: false,
    allowBase64: options.allowBase64,
  }) || /^(\/|#|mailto:|sms:|fax:|tel:)/.test(url)
    ? url
    : `https://${url}`;
};

export function filterFiles(
  files: File[],
  { allowedMimeTypes, maxFileSize }: FileValidationOptions,
): [File[], FileError[]] {
  const valid: File[] = [],
    errors: FileError[] = [];
  for (const file of files) {
    if (
      allowedMimeTypes.length &&
      !allowedMimeTypes.includes(file.type) &&
      !allowedMimeTypes.includes(file.type.split("/")[0] + "/*")
    )
      errors.push({ file, reason: "type" });
    else if (!file.size || (maxFileSize && file.size > maxFileSize))
      errors.push({ file, reason: "size" });
    else valid.push(file);
  }
  return [valid, errors];
}
