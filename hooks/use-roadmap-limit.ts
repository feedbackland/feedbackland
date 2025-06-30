import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";

export function useRoadmapLimit() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getRoadmapLimit.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
