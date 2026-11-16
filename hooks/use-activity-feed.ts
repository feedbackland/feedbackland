import { useSearchSession } from "./use-search-session";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import {
  FeedbackCategories,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";

export function useActivityFeed({
  enabled,
  pageSize,
  orderBy,
  status,
  categories,
  excludeFeedback,
  excludeComments,
  searchValue,
  unseenOnly,
  unscreenedOnly,
}: {
  enabled: boolean;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  categories: FeedbackCategories;
  excludeFeedback: boolean;
  excludeComments: boolean;
  searchValue: string;
  unseenOnly: boolean;
  unscreenedOnly?: boolean;
}) {
  const trpc = useTRPC();
  const session = useSearchSession("activity", searchValue, [
    orderBy,
    status,
    [...new Set(categories ?? [])].sort(),
    excludeFeedback,
    excludeComments,
    unseenOnly,
    unscreenedOnly,
  ]);
  const trpcQuery = trpc.getActivityFeed.infiniteQueryOptions(
    {
      pageSize,
      orderBy,
      status,
      categories,
      excludeFeedback,
      excludeComments,
      searchValue: session.text,
      unseenOnly,
      unscreenedOnly,
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
