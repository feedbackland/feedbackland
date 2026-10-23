"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  EMBED_PARAM,
  parseEmbedSurface,
  type EmbedSurface,
  type SurfaceState,
} from "@/lib/embed-surface";
const EmbedSurfaceContext = createContext<SurfaceState>("unresolved");
const subscribe = (changed: () => void) => {
  window.addEventListener("popstate", changed);
  return () => window.removeEventListener("popstate", changed);
};
const readSurface = (): SurfaceState =>
  parseEmbedSurface(
    new URLSearchParams(window.location.search).getAll(EMBED_PARAM),
  ) ?? "first-party";
/** Missing proxy hints stay unresolved during SSR and hydration. The first
 * client snapshot resolves before any descendant transport is constructed.
 * Navigation re-reads the current URL; full reloads read that same URL, so
 * board links must retain embed and mode themselves. */
export function EmbedProvider({
  initialSurface = "unresolved",
  children,
}: {
  initialSurface?: SurfaceState;
  children: React.ReactNode;
}) {
  useSearchParams();
  const surface = useSyncExternalStore(
    subscribe,
    readSurface,
    () => initialSurface,
  );
  return (
    <EmbedSurfaceContext.Provider value={surface}>
      {children}
    </EmbedSurfaceContext.Provider>
  );
}
export const useSurfaceState = () => useContext(EmbedSurfaceContext);
export function useEmbedSurface(): EmbedSurface {
  return useSurfaceState() === "drawer" ? "drawer" : null;
}
export const useIsDrawerEmbed = () => useSurfaceState() === "drawer";
export { parseEmbedSurface };
export type { EmbedSurface };
