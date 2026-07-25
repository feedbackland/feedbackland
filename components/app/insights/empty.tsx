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
import { Layers, MessageSquarePlus, SearchX, Sparkles } from "lucide-react";

/** Nothing on the board to analyse yet. */
export function InsightsNoFeedback() {
  return (
    <Empty className="py-16">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <MessageSquarePlus />
        </EmptyMedia>
        <EmptyTitle>No feedback to work with yet</EmptyTitle>
        <EmptyDescription>
          Once people start posting, what they say gets grouped here into the
          handful of themes worth doing something about.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Feedback exists; the insights have never been generated.
 *
 * The one screen guaranteed to be read before anything is generated, so it is
 * where the page explains itself in full: what goes in, what comes out, and what
 * decides the order. The icon says the same thing — separate posts stacked into
 * one — which is more use here than a sparkle.
 */
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
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <Layers />
        </EmptyMedia>
        <EmptyTitle>See what your feedback adds up to</EmptyTitle>
        <EmptyDescription>
          All {postCount} open {postCount === 1 ? "post" : "posts"} get read and
          grouped with the ones asking for the same thing, then ranked by how
          many people are behind each theme, how fast it is growing, and how
          much the problem hurts.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button size="lg" onClick={onGenerate} loading={isGenerating}>
          <Sparkles className="size-4" />
          Generate insights
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** Search matched nothing. */
export function InsightsNoMatches({ onClear }: { onClear: () => void }) {
  return (
    <Empty className="py-14">
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
