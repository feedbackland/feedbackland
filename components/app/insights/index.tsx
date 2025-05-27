"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInsights } from "@/hooks/use-insights";
import { Error } from "@/components/ui/error";
import { Insight } from "@/components/app/insight";
import { useInView } from "react-intersection-observer";
import { InsightsLoading } from "./loading";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { InsightsPdfDocument } from "./insights-pdf-document";
import { DownloadIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-8 py-4">
        <div className="flex-1 space-y-1">
          <div className="mb-0 flex items-start justify-between">
            <div className="flex flex-col">
              <h2 className="h3">
                {isGenerating ? `Generating AI Insights...` : `AI Insights`}
              </h2>
              {!isGenerating && hasInsights && (
                <p className="text-muted-foreground text-sm">
                  Generated on{" "}
                  {new Date(insights[0].createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  .
                </p>
              )}

              {!isGenerating && hasNoInsights && (
                <p className="text-muted-foreground text-sm">
                  Click Generate to retreive AI insights
                </p>
              )}

              {isGenerating && (
                <p className="text-muted-foreground text-sm">
                  This might take a few minutes
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasInsights && ( // Only show download button if there are insights
                <PDFDownloadLink
                  document={<InsightsPdfDocument insights={insights} />}
                  fileName="ai_insights_report.pdf"
                >
                  {({ loading }) => (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" loading={loading}>
                          <DownloadIcon className="size-4!" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download as PDF</TooltipContent>
                    </Tooltip>
                  )}
                </PDFDownloadLink>
              )}
              <Button
                size="default"
                variant="default"
                onClick={handleGenerateClick}
                loading={isGenerating}
              >
                {hasInsights ? `Regenerate` : `Generate`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!!(isGenerating || isPending) && <InsightsLoading />}

      {isGeneratingError && (
        <Error
          title="Could not generate insights"
          description="An error occured while trying to generate AI insights. Please try again."
        />
      )}

      {!isGeneratingError && isError && (
        <Error
          title="Could not load insights"
          description="An error occured while trying to load the AI insights. Please try again."
        />
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
