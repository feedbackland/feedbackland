import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useOrg() {
  const trpc = useTRPC();
  const queryFn = trpc.getOrg.queryOptions();
  const queryKey = queryFn.queryKey;
  const query = useQuery(queryFn);
  return { queryKey, query };
}
