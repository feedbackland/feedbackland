"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { MessageSquarePlus, SearchX, Sparkles } from "lucide-react";

/** Nothing on the board to analyse yet. */
export function InsightsNoFeedback() {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquarePlus />
        </EmptyMedia>
        <EmptyTitle>No feedback to work with yet</EmptyTitle>
        <EmptyDescription>
          Once people start posting, this page groups what they say into the
          handful of things worth doing next.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Feedback exists; the insights have never been generated. */
export function InsightsFirstRun({
  onGenerate,
  isGenerating,
  postCount,
}: {
  onGenerate: () => void;
  isGenerating: boolean;
  postCount: number;
}) {
  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sparkles className="text-under-consideration" />
        </EmptyMedia>
        <EmptyTitle>See what to build next</EmptyTitle>
        <EmptyDescription>
          All {postCount} open {postCount === 1 ? "post" : "posts"} get read and
          grouped, then ranked by how many people are asking, how fast that is
          growing, and how much the problem hurts.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button size="lg" onClick={onGenerate} loading={isGenerating}>
          <Sparkles className="mr-2 size-4" />
          Generate insights
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** Search matched nothing. */
export function InsightsNoMatches({ onClear }: { onClear: () => void }) {
  return (
    <Empty className="border-0 py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>No insights match your search</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear search
        </Button>
      </EmptyContent>
    </Empty>
  );
}
