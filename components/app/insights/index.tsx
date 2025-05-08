"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { useInsights } from "@/hooks/use-insights";

export function Insights() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    query: { data },
  } = useInsights({ enabled: true });

  const [error, setError] = useState<string | null>(null);

  const insights = data?.pages.flatMap((page) => page.items) || [];

  const generateInsightsMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      onError: () => {
        setError("Something went wrong. Please try again.");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getInsights.queryKey().slice(0, 1),
        });
      },
    }),
  );

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          generateInsightsMutation.mutate();
        }}
        loading={generateInsightsMutation.isPending}
      >
        Generate Insights
      </Button>

      {generateInsightsMutation.isPending && (
        <div className="flex items-center justify-center gap-2 p-4">
          <Spinner size="small" />
          <p className="text-sm">Generating insights...</p>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {insights &&
        insights.map((insight) => <div key={insight.id}>{insight.title}</div>)}
    </div>
  );
}
