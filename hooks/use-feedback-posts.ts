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
  const trpcQuery = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 10, orderBy },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: null,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
