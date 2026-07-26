import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useFeedbackPostCount({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getFeedbackPostCount.queryOptions(undefined, {
    enabled,
  });
  const query = useQuery(trpcQuery);
  return { queryKey: trpcQuery.queryKey, query };
}
