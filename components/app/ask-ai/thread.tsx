"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type AssistantState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
} from "lucide-react";
import { useMemo, useState, type FC } from "react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { usePlatformUrl } from "@/hooks/use-platform-url";
import {
  AskAiNoFeedback,
  AskAiSuggestions,
  AskAiWelcome,
} from "@/components/app/ask-ai/welcome";
import {
  CitationSources,
  CitationsProvider,
} from "@/components/app/ask-ai/citations";
import { MarkdownText } from "@/components/app/ask-ai/markdown";
import { extractCitedPostIds, rewriteCitationsForCopy } from "@/lib/ask-ai";
import { cn } from "@/lib/utils";

/**
 * The chat fills what is left of the window below the board header, the admin
 * tabs, this page's own heading and the board's bottom margin — 17rem of chrome,
 * which leaves a little slack for the heading's description wrapping to a second
 * line on a narrow window rather than putting a scrollbar on the page. The floor
 * keeps a short window scrolling instead of collapsing the thread.
 *
 * Shared with the loading skeleton so the two cannot drift apart.
 */
export const ASK_AI_THREAD_HEIGHT = "h-[calc(100dvh-17rem)] min-h-[24rem]";

const isEmptyThread = (state: AssistantState) =>
  state.thread.messages.length === 0;

export function AskAiThread({
  postCount,
}: {
  postCount: number | null | undefined;
}) {
  const isEmpty = useAuiState(isEmptyThread);

  // Withheld only when the board is known to be empty: there is nothing to ask
  // about, and an input that cannot produce an answer is worse than no input.
  const canAsk = postCount !== 0;

  return (
    <ThreadPrimitive.Root
      className={cn(
        "aui-root aui-thread-root bg-background border-border @container relative flex w-full flex-col overflow-hidden rounded-lg border shadow-xs",
        ASK_AI_THREAD_HEIGHT,
      )}
      style={{ ["--thread-max-width" as string]: "44rem" }}
    >
      {/* Anchoring each turn to the top is what makes a long answer readable:
          the question stays put and the answer streams down into the space
          below it, instead of being chased along the bottom edge. */}
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport scrollbar relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4 sm:px-6",
            isEmpty && "justify-center",
          )}
        >
          <AuiIf condition={isEmptyThread}>
            {canAsk ? (
              <AskAiWelcome postCount={postCount} />
            ) : (
              <AskAiNoFeedback />
            )}
          </AuiIf>

          <div className="mb-6 flex flex-col empty:hidden">
            <ThreadPrimitive.Messages
              components={{ UserMessage, EditComposer, AssistantMessage }}
            />
          </div>

          {/* ViewportFooter measures itself, so auto-scroll knows how much of
              the thread the composer is covering. */}
          <ThreadPrimitive.ViewportFooter
            className={cn(
              "bg-background relative flex flex-col gap-2.5 pb-5",
              !isEmpty && "sticky bottom-0 mt-auto",
            )}
          >
            {!isEmpty && (
              <div className="to-background pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-b from-transparent" />
            )}

            <ScrollToBottom />

            {canAsk && <Composer />}

            {canAsk && (
              <AuiIf
                condition={(state) =>
                  isEmptyThread(state) && state.composer.isEmpty
                }
              >
                <AskAiSuggestions />
              </AuiIf>
            )}
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

const ScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        side="top"
        variant="outline"
        className="bg-background hover:bg-accent absolute -top-10 z-10 size-8 self-center rounded-full shadow-sm disabled:invisible"
      >
        <ArrowDownIcon className="size-4" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const Composer: FC = () => {
  const isEmpty = useAuiState(isEmptyThread);

  return (
    <ComposerPrimitive.Root className="aui-composer-root bg-background focus-within:ring-ring/30 border-border relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1">
      <div className="flex items-end">
        <ComposerPrimitive.Input
          placeholder="Ask about your feedback…"
          className="aui-composer-input text-foreground placeholder:text-muted-foreground/60 max-h-40 min-h-12 flex-1 resize-none bg-transparent px-4 py-3.5 text-sm leading-relaxed outline-none"
          rows={1}
          // Only on a fresh thread. Focusing a restored one would scroll the
          // viewport away from where it was left.
          autoFocus={isEmpty}
          aria-label="Ask a question about your feedback"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="flex shrink-0 items-center py-2 pr-2">
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <Button
            type="submit"
            size="icon"
            className="size-8 rounded-lg"
            aria-label="Send"
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </ComposerPrimitive.Send>
      </AuiIf>

      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 rounded-lg"
            aria-label="Stop"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  );
};

/**
 * Our sentence first, because "TypeError: fetch failed" tells an admin nothing
 * about what to do. The transport's own words follow in the small print, where
 * they are useful on the day it is a real bug rather than a hiccup.
 */
const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="border-destructive/40 bg-destructive/5 mt-3 flex flex-col items-start gap-2 rounded-lg border p-3">
        <p className="text-destructive text-sm font-medium">
          That answer didn&apos;t come through.
        </p>
        <ErrorPrimitive.Message className="text-muted-foreground line-clamp-3 text-xs" />
        <ActionBarPrimitive.Reload asChild>
          <Button variant="outline" size="sm">
            <RefreshCwIcon className="size-3.5" />
            Try again
          </Button>
        </ActionBarPrimitive.Reload>
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

/** Only while this message is still empty — it gives way to the first token. */
const Thinking: FC = () => {
  return (
    <div
      className="text-muted-foreground mb-3 flex items-center gap-2 text-xs"
      role="status"
    >
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 0.15, 0.3].map((delay) => (
          <span
            key={delay}
            className="bg-muted-foreground/70 animate-thinking-dot size-1.5 rounded-full"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </span>
      Reading your feedback
    </div>
  );
};

const messageText = (state: AssistantState) =>
  state.message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

const AssistantMessage: FC = () => {
  // A string, so the selector's result is compared by value and the message
  // only re-renders when its text actually changes.
  const text = useAuiState(messageText);
  const isRunning = useAuiState(
    (state) => state.message.status?.type === "running",
  );

  const citedPostIds = useMemo(() => extractCitedPostIds(text), [text]);

  return (
    <MessagePrimitive.Root
      className="group relative flex w-full flex-col py-4 text-sm"
      data-role="assistant"
    >
      <CitationsProvider postIds={citedPostIds} isComplete={!isRunning}>
        {isRunning && text.length === 0 && <Thinking />}

        <div className="animate-in fade-in fill-mode-both min-w-0 overflow-x-auto motion-reduce:animate-none">
          <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
        </div>

        <MessageError />

        <CitationSources />

        <div className="mt-2.5 flex opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </CitationsProvider>
    </MessagePrimitive.Root>
  );
};

/**
 * Copies the answer with its citations rewritten to real post URLs, rather than
 * the raw `[1](post:…)` the model wrote — because the place an answer gets
 * pasted is a ticket or a message, and a link that only this page understands
 * would arrive there as litter.
 */
const CopyAnswer: FC = () => {
  const text = useAuiState(messageText);
  const platformUrl = usePlatformUrl();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(rewriteCitationsForCopy(text, platformUrl))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <TooltipIconButton
      tooltip="Copy"
      onClick={copy}
      className="hover:bg-accent/60 text-muted-foreground size-7 rounded-lg"
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </TooltipIconButton>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="flex items-center gap-0.5"
    >
      <CopyAnswer />
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton
          tooltip="Ask again"
          className="hover:bg-accent/60 text-muted-foreground size-7 rounded-lg"
        >
          <RefreshCwIcon className="size-3.5" />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both group relative flex w-full gap-3 py-4 text-sm motion-reduce:animate-none"
      data-role="user"
    >
      <div className="min-w-8 flex-1" />

      <div className="flex max-w-[85%] flex-col items-end">
        <div className="relative">
          <div className="bg-muted/70 rounded-2xl px-4 py-2.5">
            <MessagePrimitive.Parts />
          </div>

          <div className="absolute top-1/2 right-full mr-2 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
            <UserActionBar />
          </div>
        </div>

        <BranchPicker className="mt-1 justify-end" />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton
          tooltip="Edit"
          className="hover:bg-accent/60 text-muted-foreground size-7 rounded-lg"
        >
          <PencilIcon className="size-3.5" />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="flex w-full flex-col gap-4 py-4">
      <ComposerPrimitive.Root className="bg-muted/70 ml-auto flex w-full max-w-[85%] flex-col rounded-2xl">
        <ComposerPrimitive.Input
          className="text-foreground flex min-h-15 w-full resize-none bg-transparent p-4 text-sm outline-none"
          autoFocus
        />

        <div className="mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Ask again</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "text-muted-foreground mr-2 -ml-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous" className="size-6">
          <ChevronLeftIcon className="size-3.5" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium tabular-nums">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next" className="size-6">
          <ChevronRightIcon className="size-3.5" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
