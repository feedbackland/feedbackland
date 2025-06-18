import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useActiveFeedbackPostCount() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActiveFeedbackPostCount.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
