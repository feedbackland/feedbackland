import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useSearchActivityFeed({
  searchValue,
  enabled = false,
}: {
  searchValue: string;
  enabled: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.searchActivityFeed.queryOptions(
    { searchValue },
    { enabled },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
