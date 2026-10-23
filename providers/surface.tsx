"use client";
import { useSyncExternalStore } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import type { ResolvedSurface } from "@/lib/embed-surface";
import { useSurfaceState } from "./embed";
import { TRPCClientProvider } from "./trpc-client";
import { JotaiProvider } from "./jotai";
const subscribe = () => () => {};
export function useIsTopLevel() {
  return useSyncExternalStore(
    subscribe,
    () => window.self === window.top,
    () => null,
  );
}
export function SurfaceProviders({
  surface: explicit,
  children,
}: {
  surface?: ResolvedSurface;
  children: React.ReactNode;
}) {
  const boardSurface = useSurfaceState();
  const surface = explicit ?? boardSurface;
  const topLevel = useIsTopLevel();
  if (
    surface === "unresolved" ||
    (surface === "first-party" && topLevel === null)
  )
    return (
      <p role="status" data-surface="unresolved">
        Loading feedback…
      </p>
    );
  if (surface === "first-party" && !topLevel)
    return <p role="alert">Open this page in its own tab.</p>;
  return (
    <TRPCClientProvider key={surface} surface={surface}>
      <AuthProvider>
        <JotaiProvider>{children}</JotaiProvider>
      </AuthProvider>
    </TRPCClientProvider>
  );
}
