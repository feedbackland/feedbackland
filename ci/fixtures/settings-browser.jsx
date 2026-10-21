import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { TRPCProvider, useTRPC } from "@/providers/trpc-client";
import { PlatformTitle } from "@/components/app/settings/platform-title";
import { PlatformDescription } from "@/components/app/settings/platform-description";

// Only the transport, auth identity and router are fixtures. Production forms,
// private settings query, mutation hook and React Query cache run in Chromium.
let state = {
  revision: "1",
  platformTitle: "Original title",
  platformDescription: "Original description",
  logoImageId: null,
  allowIndexing: true,
  setupCompletedAt: null,
};
let failNextRead = false;
const attempts = [];
const cache = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
    mutations: { retry: false },
  },
});
const client = createTRPCClient({
  links: [
    () =>
      ({ op }) =>
        observable((observer) => {
          if (op.path === "getSettings") {
            if (failNextRead) {
              failNextRead = false;
              observer.error(
                TRPCClientError.from(new Error("Fixture read outage")),
              );
              return;
            }
          } else if (op.path === "updateSettings") {
            attempts.push({ ...op.input });
            if (op.input.expectedRevision !== state.revision) {
              observer.error(
                TRPCClientError.from({
                  error: {
                    code: -32009,
                    message: "CONFLICT",
                    data: { code: "CONFLICT", httpStatus: 409 },
                  },
                }),
              );
              return;
            }
            const patch = { ...op.input };
            delete patch.expectedRevision;
            if (patch.platformTitle !== undefined)
              patch.platformTitle = patch.platformTitle.trim();
            state = {
              ...state,
              ...patch,
              revision: (BigInt(state.revision) + 1n).toString(),
            };
          } else throw new Error(`Unexpected fixture operation ${op.path}`);
          observer.next({ result: { data: { ...state } } });
          observer.complete();
        }),
  ],
});

function Fixture() {
  const trpc = useTRPC();
  useEffect(() => {
    window.settingsFixture = {
      refreshes: 0,
      snapshot: () => ({
        server: { ...state },
        cached: cache.getQueryData(trpc.getSettings.queryKey()),
        attempts: [...attempts],
      }),
      failNextRead: () => {
        failNextRead = true;
      },
      externalUpdate: async (patch) => {
        state = {
          ...state,
          ...patch,
          revision: (BigInt(state.revision) + 1n).toString(),
        };
        await cache.invalidateQueries({
          queryKey: trpc.getSettings.queryKey(),
        });
      },
    };
  }, [trpc]);
  return (
    <>
      <section data-testid="title">
        <PlatformTitle />
      </section>
      <section data-testid="description">
        <PlatformDescription />
      </section>
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={cache}>
    <TRPCProvider trpcClient={client} queryClient={cache}>
      <Fixture />
    </TRPCProvider>
  </QueryClientProvider>,
);
