import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";

export function useRoadmapUsage() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getRoadmapUsage.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
