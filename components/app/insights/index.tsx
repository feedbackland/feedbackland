"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInsights } from "@/hooks/use-insights";
import { Error } from "@/components/ui/error";
import { InsightsItem } from "./item";
import { useInView } from "react-intersection-observer";

export function Insights() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    query: {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending,
      isError,
    },
  } = useInsights({ enabled: true });

  const generateInsightsMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      onSettled: () => {
        queryClient.refetchQueries({
          queryKey: trpc.getInsights.queryKey().slice(0, 1),
        });
      },
    }),
  );

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  const handleGenerateClick = () => {
    generateInsightsMutation.mutate();
  };

  const isGenerating = generateInsightsMutation.isPending;

  const isGeneratingError = !isGenerating && generateInsightsMutation.isError;

  const insights = !!(isGenerating || isGeneratingError)
    ? []
    : data?.pages.flatMap((page) => page.items) || [];

  const hasNoInsights =
    !isPending && !isGenerating && (!insights || insights?.length === 0);

  const hasInsights = !isPending && !isGenerating && insights?.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="space-y-1">
          <h1 className="h4">
            {hasInsights && `${insights.length} Insights`}
            {hasNoInsights && `No insights generated yet`}
            {isGenerating && `Generating insights...`}
          </h1>
          <p className="text-muted-foreground text-sm">
            {hasInsights &&
              `Generated on ${new Date(insights[0].createdAt).toLocaleDateString()}`}
            {hasNoInsights &&
              `Instantly summarize and rank key takeaways from active feedback.
            Click Generate to start.`}
            {isGenerating && `This might take a few minutes`}
          </p>
        </div>
        <Button
          size="default"
          value="default"
          onClick={handleGenerateClick}
          loading={isGenerating}
        >
          {hasInsights ? `Regenerate` : `Generate`}
        </Button>
      </div>

      {isGeneratingError && (
        <Error
          title="Could not generate insights"
          description="An error occured while trying to generate insights. Please try again."
        />
      )}

      {!isGeneratingError && isError && (
        <Error
          title="Could not load insights"
          description="An error occured while trying to load the insights. Please try again."
        />
      )}

      {hasInsights && (
        <div className="flex flex-col items-stretch space-y-4">
          {insights.map((item) => (
            <InsightsItem key={item.id} item={item} />
          ))}
        </div>
      )}

      <div ref={ref} className="h-1 w-full" />
    </div>
  );
}
