import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useFeedbackPosts() {
  const trpc = useTRPC();

  const queryFn = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 10, cursor: null },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const queryKey = queryFn.queryKey;

  const query = useInfiniteQuery(queryFn);

  return { queryFn, queryKey, query };
}
