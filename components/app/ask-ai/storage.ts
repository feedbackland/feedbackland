import type { UIMessage } from "ai";

const legacyKey = "feedbackland-ask-ai:board";
const key = "feedbackland-ask-ai:session";
const maxStoredChars = 400_000;
let activeSession: string | undefined;

function storedThread(sessionId: string): UIMessage[] {
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return [];
  const record = JSON.parse(raw) as { sessionId?: unknown; messages?: unknown };
  if (record?.sessionId !== sessionId || !Array.isArray(record.messages))
    return [];
  return record.messages.filter(
    (item): item is UIMessage =>
      typeof item?.id === "string" &&
      (item.role === "assistant" || item.role === "user") &&
      Array.isArray(item.parts),
  );
}

export function activateStoredThread(sessionId: string) {
  activeSession = sessionId;
  try {
    window.sessionStorage.removeItem(legacyKey);
    if (!storedThread(sessionId).length) window.sessionStorage.removeItem(key);
  } catch {
    clearStoredThread(sessionId);
    activeSession = sessionId;
  }
}

export function readStoredThread(sessionId: string) {
  try {
    return storedThread(sessionId);
  } catch {
    return [];
  }
}

export function saveStoredThread(sessionId: string, messages: UIMessage[]) {
  if (activeSession !== sessionId) return;
  try {
    const serialized = JSON.stringify({ sessionId, messages });
    if (serialized.length > maxStoredChars)
      window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, serialized);
  } catch {
    // Privacy settings and storage quotas can make persistence unavailable.
  }
}

export function clearStoredThread(sessionId: string) {
  const wasActive = activeSession === sessionId;
  if (wasActive) activeSession = undefined;
  try {
    window.sessionStorage.removeItem(legacyKey);
    const raw = window.sessionStorage.getItem(key);
    if (wasActive || (raw && JSON.parse(raw)?.sessionId === sessionId))
      window.sessionStorage.removeItem(key);
  } catch {
    // The live thread is cleared independently of browser storage.
  }
}
