import { useState } from "react";

function capability() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function useSearchSession(value: string, filters: unknown) {
  const key = value.trim() ? JSON.stringify([value.trim(), filters]) : "";
  const [session, setSession] = useState(() => ({
    key,
    capability: key ? capability() : undefined,
  }));
  if (session.key !== key)
    setSession({ key, capability: key ? capability() : undefined });
  return {
    capability: session.key === key ? session.capability : undefined,
    restart: () => setSession({ key, capability: capability() }),
  };
}
