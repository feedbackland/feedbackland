import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useComments({
  postId,
  enabled = true,
}: {
  postId: string;
  enabled?: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getComments.infiniteQueryOptions(
    { postId, limit: 20, cursor: null },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
