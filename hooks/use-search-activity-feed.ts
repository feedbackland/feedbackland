import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useSearchActivityFeed({
  searchValue,
  enabled = false,
  page,
  pageSize,
}: {
  searchValue: string;
  enabled: boolean;
  page: number;
  pageSize: number;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.searchActivityFeed.queryOptions(
    { page, pageSize, searchValue },
    { enabled },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
