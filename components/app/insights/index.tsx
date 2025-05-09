"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useInsights } from "@/hooks/use-insights";
import { Error } from "@/components/ui/error";
import { InsightsItem } from "./item";

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

  const isPending = generateInsightsMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1>
            {!isPending && `No insights yet`}{" "}
            {isPending && `Generating insights...`}
          </h1>
          <p>
            {isPending && `This migth take up to a few minutes.`}
            {!isPending &&
              `Instantly summarize and rank key takeaways from active feedback.
            Click &apos;Generate&apos; to start.`}
          </p>
        </div>
        <Button
          size="default"
          value="default"
          onClick={() => {
            generateInsightsMutation.mutate();
          }}
          loading={isPending}
        >
          Generate Insights
        </Button>
      </div>

      {error && (
        <Error
          title="Could not generate insights"
          description="An error occured while trying to generate insights. Please try again."
        />
      )}

      {insights &&
        insights.map((item) => <InsightsItem key={item.id} item={item} />)}
    </div>
  );
}
