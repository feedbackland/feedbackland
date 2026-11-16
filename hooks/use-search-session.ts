import { atom, useAtomValue, useStore } from "jotai";
import { useCallback, useEffect } from "react";
import { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "@/trpc";
import { useTRPCClient } from "@/providers/trpc-client";
import { canonicalSearchText } from "@/lib/search/text";

type Session = {
  key: string;
  capability?: string;
  error?: TRPCClientError<AppRouter>;
  errorAt?: number;
};
const sessions = {
  board: atom<Session | null>(null),
  activity: atom<Session | null>(null),
};

export function useSearchSession(
  surface: keyof typeof sessions,
  value: string,
  filters: unknown,
) {
  const text = canonicalSearchText(value);
  const key = text ? JSON.stringify([text, filters]) : "";
  const state = sessions[surface];
  const store = useStore();
  const current = useAtomValue(state);
  const client = useTRPCClient();
  const start = useCallback(() => {
    if (!key) {
      store.set(state, null);
      return;
    }
    const pending: Session = { key };
    store.set(state, pending);
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    void client.issueSearchTicket.mutate({ nonce }).then(
      (capability) => {
        if (store.get(state) === pending) store.set(state, { key, capability });
      },
      (cause: Error) => {
        if (store.get(state) === pending)
          store.set(state, {
            key,
            error: TRPCClientError.from<AppRouter>(cause),
            errorAt: Date.now(),
          });
      },
    );
  }, [client, key, state, store]);

  useEffect(() => {
    if ((store.get(state)?.key ?? "") !== key) start();
  }, [key, start, state, store]);

  const session = current?.key === key ? current : undefined;
  return {
    text,
    capability: session?.capability,
    error: session?.error,
    errorAt: session?.errorAt,
    restart: start,
  };
}
