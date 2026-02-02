"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyContent,
} from "@/components/ui/empty";
import { Sparkles } from "lucide-react";

interface InsightsEmptyProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

export function InsightsEmpty({ onGenerate, isGenerating }: InsightsEmptyProps) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sparkles className="text-violet-600 dark:text-violet-400" />
        </EmptyMedia>

        <EmptyTitle>Generate Your AI Roadmap</EmptyTitle>

        <EmptyDescription className="max-w-md">
          Let AI analyze your feedback and create a prioritized roadmap of
          insights, feature requests, and issues to address.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button size="lg" onClick={onGenerate} loading={isGenerating}>
          <Sparkles className="mr-2 size-4" />
          Generate AI Roadmap
        </Button>
      </EmptyContent>
    </Empty>
  );
}
