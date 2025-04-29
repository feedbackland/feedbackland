import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import {
  FeedbackCategories,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";

export function useActivityFeed({
  enabled,
  page,
  pageSize,
  orderBy = "newest",
  status = null,
  categories = null,
  excludeFeedback = false,
  excludeComments = false,
}: {
  enabled: boolean;
  page: number;
  pageSize: number;
  orderBy: FeedbackOrderBy;
  status: FeedbackStatus;
  categories: FeedbackCategories;
  excludeFeedback: boolean;
  excludeComments: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.queryOptions(
    {
      page,
      pageSize,
      orderBy,
      status,
      categories,
      excludeFeedback,
      excludeComments,
    },
    {
      enabled,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
