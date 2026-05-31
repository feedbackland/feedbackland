"use client";

import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

// The query layer must stay quiet (no in-flight queries) for this long before we
// consider the initial load settled. The window does double duty: it debounces
// across the brief lull between the first fetch and the post-auth
// `invalidateQueries()` refetch wave, AND — on a route that happens to start no
// queries at all — it confirms (once fonts are ready) that there is genuinely
// nothing to wait for, so we never stall until the hard fallback.
const QUIET_WINDOW_MS = 500;

// Absolute ceiling: never strand the loading state behind a hung request.
const HARD_FALLBACK_MS = 8000;

/**
 * Returns `true` once the platform's initial load has fully settled — i.e. web
 * fonts are ready AND the React Query layer has stayed quiet for QUIET_WINDOW_MS.
 *
 * It waits on three independent signals:
 *   - Auth resolved (`useAuth().isLoaded`): the session is set only after a raw
 *     `upsertUser()` fetch that `useIsFetching` cannot see, yet it drives the
 *     header (sign-in vs. avatar vs. admin controls). Gating on it prevents
 *     revealing a logged-out header that then pops to the logged-in one.
 *   - No queries fetching (`useIsFetching`): decoupled from any specific query,
 *     this implicitly waits for the org + feedback-post data and the post-auth
 *     `invalidateQueries()` refetch wave (the tRPC links also block on
 *     `authStateReady()`, so queries stay in-flight until auth resolves).
 *   - Fonts ready: guards against a post-reveal text reflow if/when the
 *     next/font families are wired to a `font-family`.
 *
 * It can't reveal mid-load: any in-flight query keeps `isFetching > 0` and the
 * quiet window restarts. And it can't stall on a query-less route: there the
 * window simply elapses once, well before the hard fallback.
 *
 * The result is monotonic — once `true`, it stays `true` — so navigating within
 * the SPA after the first load never re-shows the gate.
 */
export function usePlatformReady(): boolean {
  const isFetching = useIsFetching();
  const { isLoaded: authLoaded } = useAuth();
  const [fontsReady, setFontsReady] = useState(false);
  const [ready, setReady] = useState(false);

  // Wait for web fonts so text doesn't reflow under the content after reveal.
  useEffect(() => {
    let cancelled = false;
    const fonts =
      typeof document !== "undefined" && "fonts" in document
        ? document.fonts.ready
        : Promise.resolve();
    fonts.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Failsafe: reveal no matter what after a hard ceiling.
  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setReady(true), HARD_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [ready]);

  // Primary path: auth resolved + fonts ready + query layer quiet for a
  // continuous window. Re-runs on every dependency change; a fetch starting (or
  // auth not yet resolved) within the window clears the pending timer, so the
  // wait restarts and we never reveal while anything is still loading.
  useEffect(() => {
    if (ready) return;
    if (!authLoaded) return;
    if (!fontsReady) return;
    if (isFetching > 0) return;
    const id = window.setTimeout(() => setReady(true), QUIET_WINDOW_MS);
    return () => window.clearTimeout(id);
  }, [ready, authLoaded, fontsReady, isFetching]);

  return ready;
}
