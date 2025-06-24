import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useUserSession({ enabled = false }: { enabled?: boolean }) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getUserSession.queryOptions({}, { enabled });
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
