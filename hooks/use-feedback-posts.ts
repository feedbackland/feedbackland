import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { FeedbackOrderBy } from "@/lib/typings";

export function useFeedbackPosts({
  enabled = false,
  orderBy = "newest",
}: {
  enabled?: boolean;
  orderBy?: FeedbackOrderBy;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 10, orderBy },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
