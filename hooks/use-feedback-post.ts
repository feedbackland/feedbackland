import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useFeedbackPost({
  postId,
}: {
  postId: string | null | undefined;
}) {
  const trpc = useTRPC();
  const queryFn = trpc.getFeedbackPost.queryOptions(
    {
      postId: postId as string,
    },
    { enabled: !!postId },
  );
  const queryKey = queryFn.queryKey;
  const query = useQuery(queryFn);
  return { queryKey, query };
}
