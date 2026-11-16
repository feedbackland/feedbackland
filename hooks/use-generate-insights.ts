import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function useGenerateInsights() {
  const trpc = useTRPC(),
    client = useQueryClient();
  const latest = useQuery(
    trpc.getInsightsRun.queryOptions(undefined, {
      refetchInterval: (q) =>
        q.state.status !== "error" && q.state.data?.status === "running"
          ? 1500
          : 10000,
    }),
  );
  const id = latest.data?.id,
    status = latest.data?.status;
  useEffect(() => {
    if (status === "succeeded" || status === "failed")
      void client.invalidateQueries({ queryKey: trpc.getInsights.queryKey() });
  }, [client, trpc, id, status]);
  const key = trpc.getInsightsRun.queryKey();
  const start = useMutation(
    trpc.startInsightsRun.mutationOptions({
      retry: false,
      onMutate: async () => {
        await client.cancelQueries({ queryKey: key });
        return {
          previousId: client.getQueryData(
            trpc.getInsightsRun.queryOptions().queryKey,
          )?.id,
        };
      },
      onSuccess: (run) => {
        // A concurrent tab may already have seen this run finish.
        client.setQueryData(
          trpc.getInsightsRun.queryOptions().queryKey,
          (old) =>
            old &&
            (BigInt(old.id) > BigInt(run.id) ||
              (run.id === old.id && old.status !== "running"))
              ? old
              : run,
        );
      },
      onSettled: () => {
        void client.invalidateQueries({ queryKey: key });
      },
    }),
  );
  return {
    start,
    latest,
    isGenerating: start.isPending || latest.data?.status === "running",
  };
}
