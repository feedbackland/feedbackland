"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInsights } from "@/hooks/use-insights";
import { Error } from "@/components/ui/error";
import { Insight } from "@/components/app/insight";
import { useInView } from "react-intersection-observer";
import { InsightsLoading } from "./loading";
import dynamic from "next/dynamic";
import { InsightsLimitAlert } from "@/components/app/insights/limit-alert";
import { useRoadmapLimit } from "@/hooks/use-roadmap-limit";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import Link from "next/link";

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
  const platformUrl = usePlatformUrl();

  const generateInsightsMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getInsights.queryKey().slice(0, 1),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.getRoadmapLimit.queryKey(),
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

  const {
    query: { data: roadmapLimit },
  } = useRoadmapLimit();

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

  const isGenerating = generateInsightsMutation.isPending;

  const isGeneratingError = !isGenerating && generateInsightsMutation.isError;

  const insights = data?.pages.flatMap((page) => page.items) || [];

  const hasInsights = !isPending && !isGenerating && insights?.length > 0;

  const hasNoInsights = !isPending && !isGenerating && !hasInsights;

  const isInitialEmptyState = !isGenerating && hasNoInsights;

  const roadmapsLeft = roadmapLimit?.left;

  return (
    <div className="space-y-1">
      <div className="mb-6 flex items-start justify-between gap-8">
        <div className="flex-1 space-y-1">
          <div className="mb-0 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <h2 className="h4 mb-1 flex flex-wrap items-center gap-2">
                {isGenerating ? `Generating Roadmap...` : `Roadmap`}
              </h2>
              {!isGenerating && hasInsights && (
                <p className="text-muted-foreground text-sm">
                  Generated on{" "}
                  {new Date(insights[0].createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  .
                </p>
              )}

              {/* {isInitialEmptyState && (
                <p className="text-muted-foreground text-sm">
                  Add some feedback to your platform and generate your first
                  roadmap!
                </p>
              )} */}

              {isGenerating && (
                <p className="text-muted-foreground text-sm">
                  This might take a few minutes
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasInsights && <InsightsDownloadButton />}
              <Button
                size="default"
                variant="default"
                onClick={handleGenerateClick}
                loading={isGenerating}
                disabled={roadmapLimit?.limitReached}
              >
                Generate
                {roadmapsLeft !== undefined &&
                  roadmapsLeft < 4 &&
                  ` (${roadmapsLeft >= 0 ? roadmapsLeft : 0} left this month)`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <InsightsLimitAlert className="mb-5" />

      {!!(isGenerating || isPending) && <InsightsLoading />}

      {isGeneratingError && (
        <Error
          title="Could not generate roadmap"
          description="An error occured while trying to generate the roadmap. Please try again."
          className="mb-4"
        />
      )}

      {!isGeneratingError && isError && (
        <Error
          title="Could not load roadmap"
          description="An error occured while trying to load the roadmap. Please try again."
          className="mb-4"
        />
      )}

      {isInitialEmptyState && (
        <div className="text-muted-foreground border-border flex w-full flex-col items-center justify-center space-y-1 rounded-xl border py-10 text-center">
          <div className="text-base font-medium">
            First add some feedback to your platform.
            <br />
            Then generate your first roadmap.
          </div>
          {platformUrl && (
            <Button variant="outline" size="default" asChild className="mt-4">
              <Link href={platformUrl} className="flex items-center gap-1">
                Add feedback
              </Link>
            </Button>
          )}
        </div>
      )}

      {hasInsights && (
        <div className="flex flex-col items-stretch space-y-5">
          {insights.map((item, index) => (
            <Insight key={item.id} item={item} index={index} />
          ))}
        </div>
      )}

      <div ref={ref} className="h-1 w-full" />
    </div>
  );
}
