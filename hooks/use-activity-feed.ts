import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";

export function useActivityFeed({
  enabled,
  page,
  pageSize,
  orderBy = "newest",
  status = null,
}: {
  enabled: boolean;
  page: number;
  pageSize: number;
  orderBy?: FeedbackOrderBy;
  status?: FeedbackStatus;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getActivityFeed.queryOptions(
    { page, pageSize, orderBy, status },
    {
      enabled,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
