"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useTRPC } from "@/providers/trpc-client";
export function useAdminSettings() {
  const trpc = useTRPC();
  const { isAdmin } = useAuth();
  return {
    query: useQuery(
      trpc.getSettings.queryOptions(undefined, { enabled: isAdmin }),
    ),
  };
}
