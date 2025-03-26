import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useFeedbackPost({
  postId,
  enabled = true,
}: {
  postId: string | null | undefined;
  enabled?: boolean;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getFeedbackPost.queryOptions(
    {
      postId: postId as string,
    },
    {
      enabled: !!(enabled && postId),
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
