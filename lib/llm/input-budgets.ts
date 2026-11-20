import "server-only";
import {
  ASK_AI_HISTORY_BYTES,
  ASK_AI_HISTORY_TURNS,
  ASK_AI_MAX_POSTS,
  ASK_AI_QUESTION_BYTES,
} from "../ask-ai";
import { maxVisionImages } from "../ai-request-limits";
import { inputBytes, type ChatFeature } from "./defaults";
import { AiError } from "./errors";

export type Message = { role: "user" | "assistant"; content: string };
export type ChatInput = {
  system: string;
  text: string;
  history?: readonly Message[];
  items?: readonly string[];
};
export function utf8Prefix(text: string, bytes: number, points = Infinity) {
  let used = 0,
    end = 0,
    count = 0;
  for (const point of text) {
    const size = Buffer.byteLength(point);
    if (count === points || used + size > bytes) break;
    used += size;
    end += point.length;
    count++;
  }
  return text.slice(0, end).toWellFormed();
}
export function prepareChat(feature: ChatFeature, input: ChatInput) {
  const { system, text, history = [], items = [] } = input;
  if (
    !system.isWellFormed() ||
    !text.isWellFormed() ||
    Buffer.byteLength(system) > 8192 ||
    history.length > ASK_AI_HISTORY_TURNS ||
    (history.length && feature !== "ask-ai") ||
    (items.length && !["ask-ai", "insights"].includes(feature))
  )
    throw new AiError("invalid-input");
  let historyBytes = 0;
  for (const message of history) {
    if (
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.isWellFormed() ||
      Buffer.byteLength(message.content) > ASK_AI_QUESTION_BYTES
    )
      throw new AiError("invalid-input");
    historyBytes += Buffer.byteLength(message.content);
  }
  let remaining =
    inputBytes[feature] -
    Buffer.byteLength(system) -
    Buffer.byteLength(text) -
    historyBytes;
  if (historyBytes > ASK_AI_HISTORY_BYTES || remaining < 0)
    throw new AiError("invalid-input");
  // Keep the cached prefix stable as the question and history grow.
  if (feature === "ask-ai" && items.length)
    remaining = Math.min(
      remaining,
      inputBytes[feature] -
        Buffer.byteLength(system) -
        ASK_AI_HISTORY_BYTES -
        ASK_AI_QUESTION_BYTES,
    );
  const selected: string[] = [];
  const maxItems = feature === "insights" ? 200 : ASK_AI_MAX_POSTS;
  for (const item of items.slice(0, maxItems)) {
    if (selected.length === maxItems || remaining <= 1) break;
    if (!item.trim()) continue;
    const entry =
      feature === "ask-ai" ? item : utf8Prefix(item, remaining - 1, 700);
    const size = Buffer.byteLength(entry) + 1;
    if (size > remaining) break;
    if (!entry) continue;
    selected.push(entry);
    remaining -= size;
  }
  const cacheCorpus = feature === "ask-ai" && selected.length > 0;
  const content = cacheCorpus ? text : [text, ...selected].join("\n");
  return {
    system,
    cacheCorpus,
    messages: [
      ...(cacheCorpus
        ? [{ role: "user" as const, content: selected.join("\n") }]
        : []),
      ...history,
      { role: "user" as const, content },
    ],
    included: selected.length,
    omitted: items.length - selected.length,
  };
}
export type VisionAsset = {
  id: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  load: (signal: AbortSignal) => Promise<Uint8Array>;
};
export function visionEligible(a: Omit<VisionAsset, "id" | "load">) {
  return (
    ["image/png", "image/jpeg", "image/webp"].includes(a.contentType) &&
    Number.isInteger(a.byteSize) &&
    a.byteSize > 0 &&
    a.byteSize <= 1_000_000 &&
    Number.isSafeInteger(a.width) &&
    Number.isSafeInteger(a.height) &&
    a.width > 0 &&
    a.height > 0 &&
    a.width * a.height <= 4_000_000
  );
}
export function planVision(assets: readonly VisionAsset[]) {
  const unique = new Map<string, VisionAsset>();
  let total = 0;
  for (const a of assets) {
    if (unique.has(a.id)) continue;
    if (unique.size >= maxVisionImages || !visionEligible(a))
      throw new AiError("invalid-input");
    unique.set(a.id, a);
    total += a.byteSize;
  }
  if (total > 4_000_000) throw new AiError("invalid-input");
  return [...unique.values()];
}
