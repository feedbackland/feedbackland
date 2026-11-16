import { useSearchSession } from "./use-search-session";
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
  const session = useSearchSession("board", searchValue, [orderBy, status]);
  const trpcQuery = trpc.getFeedbackPosts.infiniteQueryOptions(
    {
      limit: 20,
      orderBy,
      status,
      searchValue: session.text,
      capability: session.capability,
    },
    {
      enabled: enabled && (!searchValue.trim() || !!session.capability),
      ...(searchValue.trim()
        ? {
            staleTime: Infinity,
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            refetchOnReconnect: false,
          }
        : {}),
      refetchInterval: (q) =>
        q.state.status !== "error" &&
        q.state.data?.pages[0]?.search?.status === "pending"
          ? 1000
          : false,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return {
    queryKey,
    query,
    sessionError: session.error,
    sessionErrorAt: session.errorAt,
    restartSearch: session.restart,
  };
}
