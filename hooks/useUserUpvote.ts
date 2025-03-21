import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useUserUpvote({
  contentId,
  enabled,
}: {
  contentId: string;
  enabled: boolean;
}) {
  const trpc = useTRPC();
  const queryFn = trpc.getUserUpvote.queryOptions({ contentId }, { enabled });
  const queryKey = queryFn.queryKey;
  const query = useQuery(queryFn);
  return { queryKey, query };
}
