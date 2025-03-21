import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useComment({
  commentId,
}: {
  commentId: string | null | undefined;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getComment.queryOptions(
    {
      commentId: commentId as string,
    },
    {
      enabled: !!commentId,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
