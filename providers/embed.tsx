"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Which embedding surface, if any, is rendering the board. `null` means the
 * board is standalone (or embedded by something that isn't a Feedbackland
 * widget). Today the only surface is the slide-in drawer widget.
 */
export type EmbedSurface = "drawer" | null;

// Query-param contract with the embedding widget. The slide-in drawer widget
// (feedbackland-react's <OverlayWidget>) appends `?embed=drawer` to the board's
// iframe URL. Keep these two literals in sync with that widget — they are the
// board side of the same handshake as the `?mode=` theme param.
const EMBED_PARAM = "embed";
const DRAWER_SURFACE = "drawer";

const EmbedSurfaceContext = createContext<EmbedSurface>(null);

/**
 * Captures the embedding surface for the lifetime of the embedded session and
 * exposes it via {@link useEmbedSurface} / {@link useIsDrawerEmbed}.
 *
 * Design notes:
 *  - Starts at `null` (matching the server render) and reads the param once
 *    after mount, so hydration stays clean. In the drawer the widget keeps its
 *    loading shimmer up until the board signals `ready` — long after this
 *    correction lands — so the header it gates never flashes.
 *  - Held in React state, never localStorage: persisting it would leak the
 *    embedded presentation into a standalone visit at the same origin (the same
 *    isolation concern the theme handshake calls out).
 *  - Survives in-board client navigation because this provider is mounted once
 *    in the board layout; the `embed` param is only present on the iframe's
 *    initial load, and a full reload re-reads it from the (unchanged) iframe src.
 */
export function EmbedProvider({ children }: { children: React.ReactNode }) {
  const [surface, setSurface] = useState<EmbedSurface>(null);

  useEffect(() => {
    // Read directly from the URL once on mount. We intentionally do not depend
    // on `useSearchParams` here: a one-shot capture needs no reactivity, and
    // reading `window.location` keeps this provider free of the Suspense
    // boundary that `useSearchParams` would otherwise require.
    const params = new URLSearchParams(window.location.search);
    if (params.get(EMBED_PARAM) === DRAWER_SURFACE) {
      setSurface(DRAWER_SURFACE);
    }
  }, []);

  return (
    <EmbedSurfaceContext.Provider value={surface}>
      {children}
    </EmbedSurfaceContext.Provider>
  );
}

/** The embedding surface rendering the board, or `null` when standalone. */
export function useEmbedSurface(): EmbedSurface {
  return useContext(EmbedSurfaceContext);
}

/** True only when the board is embedded inside the slide-in drawer widget. */
export function useIsDrawerEmbed(): boolean {
  return useEmbedSurface() === DRAWER_SURFACE;
}
