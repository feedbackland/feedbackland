"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInsights } from "@/hooks/use-insights";
import { Error } from "@/components/ui/error";
import { Insight } from "@/components/app/insight";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
} from "@/components/ui/empty";
import { useInView } from "react-intersection-observer";
import { InsightsLoading } from "./loading";
import { InsightsEmpty } from "./empty";
import { InsightsFilterBar } from "./filter-bar";
import { useAtom } from "jotai";
import { insightsStateAtom, InsightsState } from "@/lib/atoms";
import { RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";

const InsightsDownloadButton = dynamic(
  () =>
    import("./download-button").then(
      ({ InsightsDownloadButton }) => InsightsDownloadButton,
    ),
  {
    ssr: false,
  },
);

export function Insights() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [state, setState] = useAtom(insightsStateAtom);

  const generateInsightsMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getInsights.queryKey().slice(0, 1),
        });
      },
    }),
  );

  const {
    query: {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending,
      isError,
    },
  } = useInsights({ enabled: !generateInsightsMutation?.isPending });

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  const handleGenerateClick = () => {
    queryClient.removeQueries({
      queryKey: trpc.getInsights.queryKey().slice(0, 1),
      exact: false,
    });

    generateInsightsMutation.mutate();
  };

  const handleStateChange = (updates: Partial<InsightsState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const isGenerating = generateInsightsMutation.isPending;
  const isGeneratingError = !isGenerating && generateInsightsMutation.isError;
  const insights = data?.pages.flatMap((page) => page.items) || [];
  const hasInsights = !isPending && !isGenerating && insights?.length > 0;
  const hasNoInsights = !isPending && !isGenerating && !hasInsights;
  const isInitialEmptyState = !isGenerating && hasNoInsights;

  // Filter and sort insights based on state
  const filteredInsights = useMemo(() => {
    let result = [...insights];

    // Apply search filter
    if (state.searchValue) {
      const search = state.searchValue.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(search) ||
          i.description.toLowerCase().includes(search),
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (state.sortBy) {
        case "priority":
          return Number(b.priority) - Number(a.priority);
        case "upvotes":
          return Number(b.upvotes) - Number(a.upvotes);
        case "commentCount":
          return Number(b.commentCount) - Number(a.commentCount);
        case "newest":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return result;
  }, [insights, state]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {isGenerating ? "Generating AI Roadmap..." : "AI Roadmap"}
          </h2>
          {!isGenerating && hasInsights && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Last generated on{" "}
              {new Date(insights[0].createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          {isGenerating && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Analyzing your feedback... This might take a few minutes.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasInsights && <InsightsDownloadButton />}
          <Button
            onClick={handleGenerateClick}
            loading={isGenerating}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            {hasInsights ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {!!(isGenerating || isPending) && <InsightsLoading />}

      {/* Error States */}
      {isGeneratingError && (
        <Error
          title="Could not generate AI roadmap"
          description="An error occurred while trying to generate the AI roadmap. Please try again."
          className="mb-4"
        />
      )}

      {!isGeneratingError && isError && (
        <Error
          title="Could not load AI roadmap"
          description="An error occurred while trying to load the AI roadmap. Please try again."
          className="mb-4"
        />
      )}

      {/* Empty State */}
      {isInitialEmptyState && (
        <InsightsEmpty
          onGenerate={handleGenerateClick}
          isGenerating={isGenerating}
        />
      )}

      {/* Content when insights exist */}
      {hasInsights && (
        <>
          {/* Filter Bar */}
          <InsightsFilterBar state={state} onStateChange={handleStateChange} />

          {/* Insights List */}
          <div className="flex flex-col items-stretch space-y-6">
            {filteredInsights.map((item) => (
              <Insight key={item.id} item={item} />
            ))}

            {/* No results message */}
            {filteredInsights.length === 0 && state.searchValue && (
              <Empty className="py-16">
                <EmptyHeader>
                  <EmptyTitle>No insights match your search</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleStateChange({ searchValue: "" })}
                  >
                    Clear search
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            {/* Infinite scroll trigger */}
            <div ref={ref} className="h-1 w-full" />
          </div>
        </>
      )}
    </div>
  );
}
