import type { UIMessage } from "ai";
import { getSubdomain } from "@/lib/utils";

/**
 * The thread survives leaving the page.
 *
 * Which matters here specifically because the answers are full of links: the
 * whole point of a citation is that you go and read the post, and it would be
 * absurd if checking the evidence destroyed the answer that cited it. Restoring
 * on mount also covers hopping to another admin tab and back.
 *
 * Session, not local, storage. An ad-hoc question is not a document — nobody
 * wants last month's half-finished conversation waiting for them, and Insights
 * is where anything worth keeping already lives.
 */

const PREFIX = "feedbackland-ask-ai:";

/** Past this, the thread is not worth the shared 5MB budget. */
const MAX_STORED_CHARS = 400_000;

const storageKey = () => {
  const subdomain = getSubdomain();
  if (typeof window === "undefined" || subdomain === null) return null;
  return `${PREFIX}${subdomain}`;
};

/**
 * Enough of a shape check that a stale or hand-edited entry is dropped instead
 * of being handed to the runtime. Restoring rubbish would break the page on
 * every mount for as long as the tab lived, which is a far worse outcome than
 * losing a conversation.
 */
const isMessage = (value: unknown): value is UIMessage => {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<UIMessage>;
  return (
    typeof message.id === "string" &&
    typeof message.role === "string" &&
    Array.isArray(message.parts)
  );
};

export const readStoredThread = (): UIMessage[] => {
  const key = storageKey();
  if (!key) return [];

  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isMessage)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export const saveStoredThread = (messages: UIMessage[]) => {
  const key = storageKey();
  if (!key) return;

  try {
    const serialised = JSON.stringify(messages);
    if (serialised.length > MAX_STORED_CHARS) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, serialised);
  } catch {
    // A full or unavailable store costs the admin nothing but continuity.
  }
};

export const clearStoredThread = () => {
  const key = storageKey();
  if (!key) return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Same.
  }
};
