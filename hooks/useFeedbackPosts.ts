import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useFeedbackPosts({ enabled = true }: { enabled?: boolean }) {
  console.log("useFeedbackPosts enabled", enabled);
  const trpc = useTRPC();
  const queryFn = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 10, cursor: null },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = queryFn.queryKey;
  const query = useInfiniteQuery(queryFn);

  return { queryKey, query };
}
