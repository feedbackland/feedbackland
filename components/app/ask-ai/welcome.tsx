"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { MessageSquarePlus } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ASK_AI_MAX_POSTS } from "@/lib/ask-ai";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Three questions, chosen for what they demonstrate rather than for coverage.
 *
 * The four that shipped before advertised the wrong product: "List all posts"
 * and "Summarize feedback" are what the board and the Insights page already do,
 * better, and none of them showed anything only a conversation can do. These
 * take a different cut each — one synthesis, one over time, one over status —
 * and every one of them is a question the board's own UI cannot answer.
 */
const QUESTIONS = [
  "What's the most common complaint?",
  "What came in over the last two weeks?",
  "Which requests are already planned or in progress?",
];

function Scope({ postCount }: { postCount: number | null | undefined }) {
  // Each branch owns its own element rather than filling a shared <p>: the
  // placeholder is a div, and a div inside a paragraph is invalid HTML that the
  // browser silently reparents, which breaks hydration. Both branches occupy the
  // same one-line box, so nothing moves when the count lands.
  if (postCount === undefined) {
    return (
      <div className="mt-1.5 flex h-5 items-center">
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }

  return (
    <p className="text-muted-foreground mt-1.5 min-h-5 text-sm">
      <ScopeText postCount={postCount} />
    </p>
  );
}

function ScopeText({ postCount }: { postCount: number | null }) {
  const maximum = Math.min(postCount ?? ASK_AI_MAX_POSTS, ASK_AI_MAX_POSTS);
  return <>Answers can use up to {maximum.toLocaleString()} recent posts.</>;
}

export function AskAiWelcome({
  postCount,
}: {
  postCount: number | null | undefined;
}) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <h2 className="text-foreground text-lg font-medium tracking-tight">
        What do you want to know?
      </h2>
      <Scope postCount={postCount} />
    </div>
  );
}

/**
 * Sits under the composer rather than above it, so the thing you came to do —
 * type a question — is what the eye lands on, and the examples are there for
 * when it does not come to mind.
 */
export function AskAiSuggestions() {
  return (
    <div
      className="flex w-full flex-col gap-2"
      role="group"
      aria-label="Example questions"
    >
      {QUESTIONS.map((question) => (
        <ThreadPrimitive.Suggestion
          key={question}
          prompt={question}
          send
          asChild
        >
          <button
            type="button"
            // Filled rather than outlined, so three of them stacked under the
            // composer read as examples to pick from and not as three more
            // inputs to fill in.
            className="bg-muted/60 hover:bg-muted text-foreground animate-in fade-in slide-in-from-bottom-1 fill-mode-both cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors motion-reduce:animate-none"
          >
            {question}
          </button>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
}

/** Nothing on the board to ask about yet. */
export function AskAiNoFeedback() {
  return (
    <Empty className="py-10">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <MessageSquarePlus />
        </EmptyMedia>
        <EmptyTitle>No feedback to ask about yet</EmptyTitle>
        <EmptyDescription>
          Once people start posting, you can ask anything about what they said
          and get an answer that links back to the posts behind it.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
