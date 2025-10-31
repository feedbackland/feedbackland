"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInsights } from "@/hooks/use-insights";
import { useSubscription } from "@/hooks/use-subscription";
import { Error } from "@/components/ui/error";
import { Insight } from "@/components/app/insight";
import { useInView } from "react-intersection-observer";
import { InsightsLoading } from "./loading";
import dynamic from "next/dynamic";
import { InsightsEmpty } from "./empty";
import { UpgradeDialog } from "@/components/app/upgrade-dialog";
import { useState } from "react";

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

  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

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
    query: { data: subscription },
  } = useSubscription();

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

  const { name, isExpired } = subscription || {};
  // const hasAccess = !!(name === "pro" && isExpired === false);
  const hasAccess = true;

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  const handleGenerateClick = () => {
    if (hasAccess) {
      queryClient.removeQueries({
        queryKey: trpc.getInsights.queryKey().slice(0, 1),
        exact: false,
      });

      generateInsightsMutation.mutate();
    } else {
      setUpgradeDialogOpen(true);
    }
  };

  const isGenerating = generateInsightsMutation.isPending;
  const isGeneratingError = !isGenerating && generateInsightsMutation.isError;
  const insights = data?.pages.flatMap((page) => page.items) || [];
  const hasInsights = !isPending && !isGenerating && insights?.length > 0;
  const hasNoInsights = !isPending && !isGenerating && !hasInsights;
  const isInitialEmptyState = !isGenerating && hasNoInsights;

  return (
    <>
      <UpgradeDialog
        title={
          isExpired ? "Your subscription is expired" : "Your trial has ended"
        }
        description={
          isExpired
            ? "Update or renew your Cloud Pro subscription to access AI Roadmaps."
            : "Your free 30-day trial has ended. To keep on generating AI roadmaps, upgrade to a paid plan for $29/month or $290/year (2 months free)."
        }
        open={upgradeDialogOpen}
        onClose={() => {
          setUpgradeDialogOpen(false);
        }}
      />
      <div className="space-y-1">
        <div className="mb-6 flex items-start justify-between gap-8">
          <div className="flex-1 space-y-1">
            <div className="mb-0 flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <h2 className="h5 mb-0.5 flex flex-wrap items-center gap-2">
                  {isGenerating ? `Generating...` : `AI Roadmap`}
                </h2>
                {!isGenerating && hasInsights && (
                  <p className="text-muted-foreground text-sm">
                    AI Roadmap last generated on{" "}
                    {new Date(insights[0].createdAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </p>
                )}

                {isGenerating && (
                  <p className="text-muted-foreground text-sm">
                    Generating AI Roadmap. This might take a few minutes...
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
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>

        {!!(isGenerating || isPending) && <InsightsLoading />}

        {isGeneratingError && (
          <Error
            title="Could not generate AI roadmap"
            description="An error occured while trying to generate the AI roadmap. Please try again."
            className="mb-4"
          />
        )}

        {!isGeneratingError && isError && (
          <Error
            title="Could not load AI roadmap"
            description="An error occured while trying to load the AI roadmap. Please try again."
            className="mb-4"
          />
        )}

        {isInitialEmptyState && <InsightsEmpty />}

        {hasInsights && (
          <div className="flex flex-col items-stretch space-y-7">
            {insights.map((item, index) => (
              <Insight key={item.id} item={item} index={index} />
            ))}
          </div>
        )}

        <div ref={ref} className="h-1 w-full" />
      </div>
    </>
  );
}
