import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { OrderBy } from "@/lib/typings";

export function useFeedbackPosts({
  enabled = false,
  orderBy = "newest",
}: {
  enabled?: boolean;
  orderBy?: OrderBy;
}) {
  const trpc = useTRPC();
  const queryFn = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 10, cursor: null, orderBy },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = queryFn.queryKey;
  const query = useInfiniteQuery(queryFn);
  return { queryKey, query };
}
