import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useSetInsightStatus() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const insightsKey = trpc.getInsights.queryKey();

  return useMutation(
    trpc.setInsightStatus.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: insightsKey });
        queryClient.invalidateQueries({
          queryKey: trpc.getComments.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getInsightEvidence.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPosts.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPostsByIds.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey().slice(0, 1),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getActivityFeed.queryKey().slice(0, 1),
        });
      },
    }),
  );
}
