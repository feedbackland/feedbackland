"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { Insights as InsightsSchema } from "@/db/schema";
import { Selectable } from "kysely";
import { useState } from "react";

type InsightsItem = Selectable<InsightsSchema>;

export function Insights() {
  const trpc = useTRPC();

  const [insightsItems, setInsightsItems] = useState<InsightsItem[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const generateInsightsMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      onSuccess: (insights) => {
        setInsightsItems(insights);
      },
      onError: (error) => {
        console.log(error);
        setError("Something went wrong. Please try again.");
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
    </div>
  );
}
