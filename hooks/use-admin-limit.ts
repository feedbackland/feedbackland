import { useTRPC } from "@/providers/trpc-client";
import { useQuery } from "@tanstack/react-query";

export function useAdminLimit() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getAdminLimit.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
