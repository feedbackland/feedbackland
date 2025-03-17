import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useSearchFeedbackPosts({
  searchValue,
  enabled = false,
}: {
  searchValue: string;
  enabled: boolean;
}) {
  const trpc = useTRPC();
  const queryFn = trpc.searchFeedbackPosts.queryOptions(
    { searchValue },
    { enabled },
  );
  const queryKey = queryFn.queryKey;
  const query = useQuery(queryFn);

  return { queryKey, query };
}
