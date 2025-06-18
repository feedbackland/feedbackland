import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useAdminCount() {
  const trpc = useTRPC();
  const trpcQuery = trpc.getAdminCount.queryOptions();
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
