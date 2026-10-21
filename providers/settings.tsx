"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { PublicSettings } from "@/lib/public-settings";
import { clientRuntime } from "@/lib/client-runtime";
const SettingsContext = createContext<PublicSettings | null>(null);
export function SettingsProvider({
  initial,
  children,
}: {
  initial: PublicSettings;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initial);
  const [buildChanged, setBuildChanged] = useState(false);
  useEffect(() => {
    clientRuntime.appUrl = initial.appUrl;
    let stopped = false,
      inFlight = false,
      lastSuccess = Date.now(),
      delay = 5000;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (stopped || inFlight || document.hidden || !navigator.onLine) return;
      inFlight = true;
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), 10_000);
      try {
        const response = await fetch("/api/settings", {
          credentials: "omit",
          cache: "no-store",
          signal: request.signal,
        });
        if (!response.ok) throw new Error("Settings unavailable");
        const next: PublicSettings = await response.json();
        if (!stopped) {
          clientRuntime.appUrl = next.appUrl;
          if (next.buildIdentity !== initial.buildIdentity) {
            clientRuntime.mutationsBlocked = true;
            setBuildChanged(true);
          }
          setSettings(next);
          lastSuccess = Date.now();
          delay = 5000;
        }
      } catch {
        delay = Math.min(30_000, delay * 2);
        if (!stopped && Date.now() - lastSuccess > 30_000)
          setSettings((old) => ({
            ...old,
            capabilities: {
              ...old.capabilities,
              chat: false,
              embeddings: false,
            },
          }));
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    };
    const tick = async () => {
      await refresh();
      if (!stopped) timer = setTimeout(tick, delay);
    };
    const hint = () => {
      void refresh();
    };
    timer = setTimeout(tick, 5000);
    window.addEventListener("focus", hint);
    window.addEventListener("online", hint);
    document.addEventListener("visibilitychange", hint);
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("feedbackland-settings");
    if (channel) channel.onmessage = hint;
    const stale = setInterval(() => {
      if (Date.now() - lastSuccess >= 30_000)
        setSettings((old) =>
          old.capabilities.chat || old.capabilities.embeddings
            ? {
                ...old,
                capabilities: {
                  ...old.capabilities,
                  chat: false,
                  embeddings: false,
                },
              }
            : old,
        );
    }, 1000);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(stale);
      clearTimeout(timer);
      channel?.close();
      window.removeEventListener("focus", hint);
      window.removeEventListener("online", hint);
      document.removeEventListener("visibilitychange", hint);
    };
  }, [initial.appUrl, initial.buildIdentity]);
  return (
    <SettingsContext.Provider value={settings}>
      {children}
      {buildChanged && (
        <div
          role="alert"
          className="bg-background fixed inset-x-0 bottom-0 z-50 border-t p-4 text-sm"
        >
          A new version is available. Reload this page before making changes.{" "}
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    </SettingsContext.Provider>
  );
}
export function useSettings() {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error("SettingsProvider is required");
  return settings;
}
