import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";

export function useAnalyzablePostLimit() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getAnalyzablePostLimit.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
