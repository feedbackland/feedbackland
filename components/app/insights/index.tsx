"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { useInsights } from "@/hooks/use-insights";

export function Insights() {
  const trpc = useTRPC();

  const insights = useInsights({ enabled: true });

  const [error, setError] = useState<string | null>(null);

  console.log(insights);

  const generateInsightsMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      onSuccess: () => {
        console.log("success");
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
