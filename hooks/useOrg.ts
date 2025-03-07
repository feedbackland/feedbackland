import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useOrg() {
  const trpc = useTRPC();
  const { data: org } = useQuery(trpc.getOrg.queryOptions());
  return org || null;
}
