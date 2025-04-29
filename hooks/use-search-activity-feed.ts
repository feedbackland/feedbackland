import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { FeedbackCategories } from "@/lib/typings";

export function useSearchActivityFeed({
  searchValue,
  enabled = false,
  page,
  pageSize,
  categories = null,
  excludeFeedback = false,
  excludeComments = false,
}: {
  searchValue: string;
  enabled: boolean;
  page: number;
  pageSize: number;
  categories: FeedbackCategories;
  excludeFeedback: boolean;
  excludeComments: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.searchActivityFeed.queryOptions(
    {
      page,
      pageSize,
      searchValue,
      categories,
      excludeFeedback,
      excludeComments,
    },
    { enabled },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
