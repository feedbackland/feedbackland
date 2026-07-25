import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useInsights({ enabled = true }: { enabled?: boolean } = {}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getInsights.queryOptions(undefined, { enabled });
  const query = useQuery(trpcQuery);
  return { queryKey: trpcQuery.queryKey, query };
}
