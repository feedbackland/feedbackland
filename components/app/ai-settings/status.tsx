"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc";
import { useTRPC, useTRPCClient } from "@/providers/trpc-client";
import { useSettings } from "@/providers/settings";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { aiSettingsPath, issueText } from "@/lib/ai-onboarding-copy";
import { Button } from "@/components/ui/button";

export type AiStatus = inferRouterOutputs<AppRouter>["getAiStatus"];
type Action =
  "enable" | "keep-off" | "remove" | "undo" | "test-again" | "credit";
function useController(initialStatus?: AiStatus) {
  const api = useTRPCClient(),
    trpc = useTRPC(),
    cache = useQueryClient(),
    router = useRouter(),
    publicSettings = useSettings();
  const query = useQuery(
    trpc.getAiStatus.queryOptions(undefined, {
      initialData: initialStatus,
      staleTime: 0,
      refetchInterval: (q) =>
        q.state.error
          ? Math.min(30000, 5000 * 2 ** Math.min(3, q.state.errorUpdateCount))
          : 5000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always",
      retry: false,
    }),
  );
  const [busy, setBusy] = useState(false),
    lock = useRef(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [alternate, setAlternate] = useState(""),
    [removedKeyUrl, setRemovedKeyUrl] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    await cache.invalidateQueries({ queryKey: trpc.getAiStatus.queryKey() });
    void cache.invalidateQueries({ queryKey: trpc.getSearchIndex.queryKey() });
    window.dispatchEvent(new Event("feedbackland-settings"));
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("feedbackland-settings");
      bc.postMessage("changed");
      bc.close();
    }
  }, [cache, trpc]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("feedbackland-settings");
    channel.onmessage = () => {
      if (!document.hidden)
        void cache.invalidateQueries({ queryKey: trpc.getAiStatus.queryKey() });
    };
    return () => channel.close();
  }, [cache, trpc]);
  const perform = useCallback(
    async (task: () => Promise<void>, confirmation = "") => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError("");
      setMessage("");
      try {
        await task();
        await refresh();
        setMessage(confirmation);
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "The action could not be completed.",
        );
        await refresh().catch(() => {});
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const [expiredSnapshot, setExpiredSnapshot] = useState<number>();
  const stale =
    !!query.dataUpdatedAt && expiredSnapshot === query.dataUpdatedAt;
  useEffect(() => {
    const at = query.dataUpdatedAt;
    if (!at) return;
    const timer = setTimeout(
      () => setExpiredSnapshot(at),
      Math.max(0, at + 30000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [query.dataUpdatedAt]);
  const status = stale ? undefined : query.data,
    identity = status?.identity;
  const change = (action: Action) => {
    if (!identity) return Promise.resolve(false);
    return perform(
      async () => {
        await api.changeAiKey.mutate({ identity, action });
        setRemovedKeyUrl(action === "remove" ? (status?.keyUrl ?? null) : null);
      },
      action === "remove"
        ? "Removed from this board. The key still exists in your OpenRouter account."
        : action === "undo"
          ? "Previous key settings restored."
          : "",
    );
  };
  const connect = (unlisted = false) => {
    if (!identity || lock.current) return;
    setAlternate("");
    const headless =
      unlisted ||
      (location.hostname !== "localhost" &&
        (location.protocol !== "https:" || !publicSettings.allowIndexing));
    const popup = headless ? window.open("about:blank", "_blank") : null;
    if (popup) popup.opener = null;
    void perform(async () => {
      try {
        const flow = await api.startOpenRouter.mutate({ identity, unlisted });
        if (flow.mode === "redirect") {
          popup?.close();
          location.assign(flow.url);
          return;
        }
        if (popup) popup.location.replace(flow.url);
        else setAlternate(flow.url);
        router.push(aiSettingsPath + "?flow=" + flow.nonce);
      } catch (e) {
        popup?.close();
        throw e;
      }
    });
  };
  return {
    status,
    unavailable: stale || !!query.error,
    busy,
    error,
    message,
    perform,
    refresh,
    change,
    connect,
    alternate,
    removedKeyUrl,
  };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function AiAdminProvider({
  children,
  initialStatus,
}: {
  children: ReactNode;
  initialStatus?: AiStatus;
}) {
  const state = useController(initialStatus);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAiAdmin() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Administrator AI context is required");
  return ctx;
}
export function statusLabel(s: AiStatus) {
  return (
    {
      on: "AI on",
      off: "AI off",
      credit: "AI: add credit",
      expired: "Credit check expired",
      paused: "AI paused",
      attention: "AI needs attention",
    }[s.state] ?? "AI status unavailable"
  );
}
export function AiNextAction({
  allowKeptOff = false,
}: {
  allowKeptOff?: boolean;
}) {
  const { status: s, busy, connect, change } = useAiAdmin();
  if (!s || (!allowKeptOff && s.keptOffAt)) return null;
  if (s.state === "expired")
    return (
      <Button
        size="sm"
        disabled={busy}
        onClick={() => void change("test-again")}
      >
        Test again
      </Button>
    );
  if (s.reason === "dimension-mismatch")
    return (
      <Button size="sm" asChild>
        <Link href="/admin/system#search-index">Review search index</Link>
      </Button>
    );
  if (s.state === "credit" || s.reason === "account-credit")
    return (
      <Button asChild size="sm">
        <a
          href="https://openrouter.ai/credits"
          target="_blank"
          rel="noreferrer"
        >
          Add credit on OpenRouter
        </a>
      </Button>
    );
  if (s.state === "paused")
    return (
      <Button asChild size="sm">
        <Link
          href={aiSettingsPath + "#limits"}
          onClick={() => {
            const panel =
              document.querySelector<HTMLDetailsElement>("details#limits");
            if (panel) panel.open = true;
          }}
        >
          {s.locked.includes("dailyCallLimit")
            ? "Set on the server by AI_DAILY_CALL_LIMIT"
            : "Raise the daily limit"}
        </Link>
      </Button>
    );
  if (s.state === "on") return null;
  const reconnect =
    s.unreadable ||
    ["invalid-key", "expired-key", "management-key", "provider-auth"].includes(
      s.reason ?? "",
    );
  if (
    (reconnect ||
      !s.canEnable ||
      s.reason === "invalid-environment" ||
      s.reason === "replica-mismatch") &&
    s.keySource === "environment"
  )
    return (
      <Link className="underline" href={aiSettingsPath}>
        Review server configuration
      </Link>
    );
  if (!reconnect && s.canEnable)
    return (
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          void change(
            s.state === "attention" && s.enabled !== false
              ? "test-again"
              : "enable",
          )
        }
      >
        {s.state === "attention" && s.enabled !== false
          ? "Test again"
          : "Turn on AI"}
      </Button>
    );
  return (
    <Button size="sm" disabled={busy} onClick={() => connect()}>
      {reconnect ? "Reconnect OpenRouter" : "Connect OpenRouter"}
    </Button>
  );
}
export function AiPill() {
  const { status, unavailable, error, message, removedKeyUrl } = useAiAdmin();
  return (
    <div className="my-3 flex flex-wrap items-center gap-3 text-sm">
      <Link className="rounded-full border px-3 py-1" href={aiSettingsPath}>
        {unavailable
          ? "AI status unavailable"
          : status
            ? statusLabel(status)
            : "Checking AI status…"}
      </Link>
      {status && status.state !== "on" && !unavailable && <AiNextAction />}
      {error && <span role="alert">{error}</span>}
      {message && (
        <span role="status">
          {message}{" "}
          {removedKeyUrl && (
            <a
              className="underline"
              href={removedKeyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Manage the removed key on OpenRouter
            </a>
          )}
        </span>
      )}
    </div>
  );
}
export function ActivityAiNotice() {
  const { status: s, perform, busy, change } = useAiAdmin(),
    api = useTRPCClient(),
    trpc = useTRPC();
  const show = !!s && !s.keptOffAt && s.state !== "on" && s.state !== "paused";
  const counts = useQuery(
    trpc.getAiNoticeCounts.queryOptions(undefined, {
      enabled: show,
      refetchInterval: 15000,
    }),
  );
  if (!s || !show) return null;
  const broken = s.state === "attention";
  const hidden = broken ? s.hideFailure : s.hideActivity;
  const dismiss = (notice: "failure" | "off" | "context") =>
    perform(async () => {
      await api.dismissAiNoticeForMe.mutate({ notice });
    });
  return (
    <div className="space-y-2">
      {!hidden && (
        <section className="mb-4 space-y-2 rounded-lg border p-4">
          <h2 className="font-semibold">
            {broken
              ? "OpenRouter needs attention"
              : s.state === "credit"
                ? "Connected to OpenRouter — add credit to finish"
                : "Let the board do the sorting"}
          </h2>
          {broken ? (
            <p>
              {issueText(s.reason)}{" "}
              {s.failures[0]?.failingSince &&
                "Since " +
                  new Date(s.failures[0].failingSince).toLocaleTimeString() +
                  ". "}{" "}
              {counts.data &&
                counts.data.unscreened +
                  " items were published without full screening."}
            </p>
          ) : (
            <p>
              Screen spam before publication, title and categorize posts, search
              by meaning, and see which requests have the most support.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <AiNextAction />
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void dismiss(broken ? "failure" : "off")}
            >
              Not now
            </Button>
            {!broken && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void change("keep-off")}
              >
                Keep AI off
              </Button>
            )}
          </div>
        </section>
      )}
      {!s.hideContext && s.state === "off" && !!counts.data?.unseen && (
        <p className="text-muted-foreground text-sm">
          {counts.data.unseen} new posts since your last visit. AI screening is
          off.{" "}
          <button className="underline" onClick={() => void dismiss("context")}>
            Dismiss notice
          </button>
        </p>
      )}
    </div>
  );
}

export function AiTabMarker() {
  const { status } = useAiAdmin();
  return status?.state === "off" ? (
    <span aria-hidden="true" className="text-muted-foreground ml-1 text-xs">
      off
    </span>
  ) : null;
}
