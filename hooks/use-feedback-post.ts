import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useFeedbackPost({
  postId,
}: {
  postId: string | null | undefined;
}) {
  const trpc = useTRPC();
  const trpcQuery = trpc.getFeedbackPost.queryOptions(
    {
      postId: postId as string,
    },
    {
      enabled: !!postId,
    },
  );
  const queryKey = trpcQuery.queryKey;
  const query = useQuery(trpcQuery);
  return { queryKey, query };
}
