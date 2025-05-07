"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query"; // Import useMutation
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function Insights() {
  const [prompt, setPrompt] = useState(
    "Summarize all feature requests. Rank them based on total number of upvotes.",
  );
  const [insightResult, setInsightResult] = useState<string | null>(null);
  const trpc = useTRPC();

  const generateInsightMutation = useMutation(
    trpc.generateInsights.mutationOptions({
      // onSuccess is called by react-query if the mutation is successful
      onSuccess: (data) => {
        setInsightResult(data.insight);
      },
      // onError is called by react-query if the mutation fails
      onError: (error) => {
        console.error("Failed to generate insight:", error);
        setInsightResult(
          `Failed to generate insights: ${error.message}. Please check the console for more details or ensure your API keys are set up correctly.`,
        );
      },
      // onSettled is called by react-query when the mutation is finished (either success or error)
      onSettled: () => {
        // You could potentially stop a global loading indicator here if you had one
      },
    }),
  );

  const handleSubmit = () => {
    // No longer async directly, react-query handles async
    if (!prompt.trim()) {
      setInsightResult("Prompt cannot be empty."); // Or handle with a toast
      return;
    }
    setInsightResult(null); // Clear previous results before new request
    generateInsightMutation.mutate({ prompt }); // Call mutate instead of mutateAsync
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Powered Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="insight-prompt">
              Ask anything about your platform&apos;s data
            </Label>
            <Textarea
              id="insight-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={generateInsightMutation.isPending} // Use isPending from react-query
          >
            {generateInsightMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Insight"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Display loading state from react-query */}
      {generateInsightMutation.isPending && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="ml-2">Generating your insight...</p>
        </div>
      )}

      {/* Display success result (insightResult state is updated by onSuccess) */}
      {insightResult &&
        !generateInsightMutation.isPending &&
        !generateInsightMutation.isError && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Insight</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{insightResult}</p>
            </CardContent>
          </Card>
        )}

      {/* Display error state from react-query */}
      {generateInsightMutation.isError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {/* Display error message from react-query's error object */}
              {generateInsightMutation.error?.message ||
                "An unknown error occurred while generating insights."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
