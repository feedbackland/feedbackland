import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export function useActivityFeed({
  enabled,
  orderBy = "newest",
  status = null,
}: {
  enabled: boolean;
  orderBy?: FeedbackOrderBy;
  status?: FeedbackStatus;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.queryOptions(
    { limit: 10, orderBy, status },
    {
      enabled,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
