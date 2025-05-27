import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useAllInsights({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getAllInsights.queryOptions({}, { enabled });
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
