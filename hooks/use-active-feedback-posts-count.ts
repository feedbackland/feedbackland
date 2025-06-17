import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useActiveFeedbackPostsCount() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActiveFeedbackPostsCount.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
