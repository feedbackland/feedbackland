import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useSubscription({ isPolling }: { isPolling: boolean }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getSubscription.queryOptions(
    {},
    {
      refetchInterval: () => (isPolling ? 3000 : false),
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
