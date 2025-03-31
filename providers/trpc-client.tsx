"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/trpc";
import { auth } from "@/lib/firebase/client";
import { Auth, getIdToken } from "firebase/auth";
import superjson from "superjson";
import { getSubdomain } from "@/lib/utils";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes (reduces unnecessary network requests)
        gcTime: 10 * 60 * 1000, // 10 minutes (keeps inactive queries in cache)
        refetchOnWindowFocus: true, // Avoids unnecessary refetching when switching tabs
        refetchOnReconnect: true, // Ensures fresh data when reconnecting
        refetchOnMount: true, // Avoids refetching every mount
        retry: 2, // Retries failed queries up to 2 times
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff for retries
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
};

async function getAuthIdToken(auth: Auth) {
  await auth.authStateReady();
  if (!auth.currentUser) return;
  return await getIdToken(auth.currentUser);
}

const getBaseUrl = () => {
  // browser should use relative url
  if (typeof window !== "undefined") return "";

  // use Vercel URL if deployed there
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // fallback to localhost for development
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export const TRPCClientProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          headers: async () => {
            const idToken = await getAuthIdToken(auth);
            const subdomain = getSubdomain();

            return {
              ...(!!idToken && { Authorization: `Bearer ${idToken}` }),
              ...(!!subdomain && { subdomain: subdomain }),
            };
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
};
