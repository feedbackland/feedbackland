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
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.infiniteQueryOptions(
    {
      pageSize,
      orderBy,
      status,
      categories,
      excludeFeedback,
      excludeComments,
      searchValue,
      unseenOnly,
    },
    {
      enabled,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useInfiniteQuery(trpcQuery);
  return { queryKey, query };
}
