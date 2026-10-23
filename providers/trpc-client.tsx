"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useEffect, useRef, useState } from "react";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/trpc";
import superjson from "superjson";
import { clientRuntime } from "@/lib/client-runtime";
import type { ResolvedSurface } from "@/lib/embed-surface";
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
export function TRPCClientProvider({
  children,
  surface,
}: {
  children: React.ReactNode;
  surface: ResolvedSurface;
}) {
  const [abort] = useState(() => new AbortController());
  const disposing = useRef(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, gcTime: 600_000 } },
      }),
  );
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: "/api/trpc",
          fetch: (url, options) => {
            if (
              options?.method?.toUpperCase() === "POST" &&
              clientRuntime.mutationsBlocked
            )
              throw new Error(
                "A new version is available; reload before making changes",
              );
            return fetch(url, {
              ...options,
              credentials: surface === "drawer" ? "omit" : "include",
              signal: options?.signal
                ? AbortSignal.any([options.signal, abort.signal])
                : abort.signal,
            });
          },
        }),
      ],
    }),
  );
  useEffect(() => {
    disposing.current = false;
    return () => {
      disposing.current = true;
      // StrictMode immediately replays setup; a real surface unmount does not.
      queueMicrotask(() => {
        if (!disposing.current) return;
        abort.abort();
        void queryClient.cancelQueries();
        queryClient.clear();
      });
    };
  }, [abort, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
