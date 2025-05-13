import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useInsights({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getInsights.infiniteQueryOptions(
    { limit: 20 },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
