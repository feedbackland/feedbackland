import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useActivityFeedMetaData({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeedMetaData.queryOptions(
    {},
    {
      enabled,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
