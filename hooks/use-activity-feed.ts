import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export function useActivityFeed({
  enabled,
  orderBy = "newest",
  status = null,
}: {
  enabled: boolean;
  orderBy?: FeedbackOrderBy;
  status?: FeedbackStatus;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.infiniteQueryOptions(
    { limit: 10, orderBy, status },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
