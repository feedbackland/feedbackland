import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";

export function useIsInsightReportLimitReached() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getIsInsightReportLimitReached.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
