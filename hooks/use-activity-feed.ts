import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useActivityFeed({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.infiniteQueryOptions(
    { limit: 10 },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
