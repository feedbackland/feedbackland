import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useUserUpvote({
  postId,
  enabled,
}: {
  postId: string;
  enabled: boolean;
}) {
  const trpc = useTRPC();
  const queryFn = trpc.getUserUpvote.queryOptions({ postId }, { enabled });
  const queryKey = queryFn.queryKey;
  const query = useQuery(queryFn);
  return { queryKey, query };
}
