import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

/**
 * Regenerating never clears the cache first: insights are updated in place on the
 * server, so the current insights stays on screen and readable throughout, and
 * a failed run leaves the admin exactly where they were.
 */
export function useGenerateInsights() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.generateInsights.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getInsights.queryKey() });
      },
    }),
  );
}
