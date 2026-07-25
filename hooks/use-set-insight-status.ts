import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";
import type { Insight } from "@/lib/typings";

/**
 * Applies a status to every post behind an insight. The insight's own status flips
 * straight away so the click feels immediate, then everything the change
 * touches — the board, the posts, the activity feed — is refetched.
 */
export function useSetInsightStatus() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const insightsKey = trpc.getInsights.queryKey();

  return useMutation(
    trpc.setInsightStatus.mutationOptions({
      onMutate: async ({ insightId, status }) => {
        await queryClient.cancelQueries({ queryKey: insightsKey });
        const previous = queryClient.getQueryData(insightsKey);

        queryClient.setQueryData(insightsKey, (current) => {
          if (!current) return current;
          return {
            ...current,
            insights: current.insights.map((insight: Insight) =>
              insight.id === insightId
                ? { ...insight, status, isMixedStatus: false }
                : insight,
            ),
          };
        });

        return { previous };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(insightsKey, context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: insightsKey });
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
