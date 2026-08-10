"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  DRAWER_SURFACE,
  EMBED_PARAM,
  parseEmbedSurface,
  type EmbedSurface,
} from "@/lib/embed-surface";

export type { EmbedSurface };

const EmbedSurfaceContext = createContext<EmbedSurface>(null);

/**
 * Captures the embedding surface for the lifetime of the embedded session and
 * exposes it via {@link useEmbedSurface} / {@link useIsDrawerEmbed}.
 *
 * Design notes:
 *  - `initialSurface` comes from the server render (the board layout reads the
 *    header the proxy derives from `?embed=drawer`). Seeding it means the
 *    server, the hydration render and every render after agree, so the drawer
 *    layout is painted once and never corrected — no hydration mismatch and no
 *    post-hydration reflow.
 *  - The mount effect is only a fallback, for a deployment whose requests never
 *    pass through the proxy. It reads `window.location` directly rather than
 *    `useSearchParams` because a one-shot capture needs no reactivity, and that
 *    keeps this provider free of the Suspense boundary `useSearchParams` would
 *    require. It no-ops once the surface is already known.
 *  - Held in React state, never localStorage: persisting it would leak the
 *    embedded presentation into a standalone visit at the same origin (the same
 *    isolation concern the theme handshake calls out).
 *  - Survives in-board client navigation because this provider is mounted once
 *    in the board layout; the `embed` param is only present on the iframe's
 *    initial load, and a full reload re-reads it from the (unchanged) iframe src.
 */
export function EmbedProvider({
  initialSurface = null,
  children,
}: {
  initialSurface?: EmbedSurface;
  children: React.ReactNode;
}) {
  const [surface, setSurface] = useState<EmbedSurface>(initialSurface);

  useEffect(() => {
    if (surface) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(EMBED_PARAM) === DRAWER_SURFACE) {
      setSurface(DRAWER_SURFACE);
    }
  }, [surface]);

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

export { parseEmbedSurface };
