import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useActivityFeedbackPostsCount() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeedbackPostsCount.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
