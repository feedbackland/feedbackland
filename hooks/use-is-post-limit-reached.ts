import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";

export function useIsPostLimitReached() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getIsPostLimitReached.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
