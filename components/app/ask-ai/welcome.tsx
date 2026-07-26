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
import { Skeleton } from "@/components/ui/skeleton";
import { ASK_AI_MAX_POSTS } from "@/lib/ask-ai";

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

/**
 * What will be read, in the admin's own units.
 *
 * The page next door earns trust by showing its arithmetic — this many posts in,
 * this many insights out. The same rule applies to an answer: knowing it was
 * drawn from all 128 posts, and not from some invisible subset, is the
 * difference between a number you can quote in a planning meeting and one you
 * cannot.
 */
function Scope({ postCount }: { postCount: number | null | undefined }) {
  if (postCount === undefined) {
    return <Skeleton className="h-4 w-56" />;
  }

  // The count could not be read. Still true, still worth saying — and better
  // than a skeleton that pulses forever.
  if (postCount === null) {
    return <>Answers come from the feedback posts on your board.</>;
  }

  if (postCount > ASK_AI_MAX_POSTS) {
    return (
      <>
        Reading the {ASK_AI_MAX_POSTS} most recent of{" "}
        {postCount.toLocaleString()} posts on your board.
      </>
    );
  }

  if (postCount === 1) {
    return <>Reading the one post on your board.</>;
  }

  return <>Reading all {postCount.toLocaleString()} posts on your board.</>;
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
      <p className="text-muted-foreground mt-1.5 flex min-h-5 items-center text-sm">
        <Scope postCount={postCount} />
      </p>
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
