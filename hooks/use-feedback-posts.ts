import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export function useFeedbackPosts({
  enabled,
  orderBy,
  status,
  searchValue,
}: {
  enabled: boolean;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  searchValue: string;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 10, orderBy, status, searchValue },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
