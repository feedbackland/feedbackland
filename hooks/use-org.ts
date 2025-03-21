import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useOrg() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getOrg.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
