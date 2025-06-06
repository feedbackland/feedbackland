import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function usePolarSubscription() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getPolarSubscription.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
