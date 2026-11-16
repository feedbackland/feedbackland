import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useUpdateStatus({ postId }: { postId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.updateFeedbackPostStatus.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.getComments.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPostsByIds.queryKey().slice(0, 1),
        });
      },
    }),
  );

  return mutation;
}
