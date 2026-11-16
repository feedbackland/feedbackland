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
  const session = useSearchSession(searchValue, [orderBy, status]);
  const trpcQuery = trpc.getFeedbackPosts.infiniteQueryOptions(
    { limit: 20, orderBy, status, searchValue, capability: session.capability },
    {
      enabled: enabled && (!searchValue.trim() || !!session.capability),
      ...(searchValue.trim()
        ? {
            staleTime: "static" as const,
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
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
  return { queryKey, query, restartSearch: session.restart };
}
