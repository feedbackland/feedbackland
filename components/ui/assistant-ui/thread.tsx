import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantApi,
} from "@assistant-ui/react";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  Square,
  UserIcon,
  TrendingUpIcon,
  UsersIcon,
  AlertCircleIcon,
  LightbulbIcon,
  type LucideIcon,
} from "lucide-react";
import type { FC } from "react";
import {
  ComposerAttachments,
  ComposerAddAttachment,
  UserMessageAttachments,
} from "@/components/ui/assistant-ui/attachment";
import { MarkdownText } from "@/components/ui/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/ui/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";

export const Thread: FC = () => {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="aui-root aui-thread-root bg-background border-border @container relative flex max-h-[calc(100dvh-200px)] w-full flex-col overflow-hidden rounded-lg border shadow-xs"
          style={{
            ["--thread-max-width" as string]: "44rem",
          }}
        >
          <ThreadHeader />
          <ThreadPrimitive.Viewport className="aui-thread-viewport scrollbar relative flex flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto scroll-smooth px-4">
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                EditComposer,
                AssistantMessage,
              }}
            />

            <ThreadPrimitive.If empty={true}>
              <ThreadWelcome />
            </ThreadPrimitive.If>

            <ThreadPrimitive.If empty={false}>
              <div className="aui-thread-viewport-spacer grow" />
            </ThreadPrimitive.If>

            <Composer />
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

const ThreadHeader: FC = () => {
  return (
    <div className="aui-thread-header flex items-center gap-3 border-b px-4 py-3">
      <div className="bg-muted flex size-8 items-center justify-center rounded-md">
        <SparklesIcon className="text-foreground size-4" />
      </div>
      <span className="text-foreground text-sm font-medium">Ask AI</span>
    </div>
  );
};

const suggestedPrompts = [
  {
    icon: TrendingUpIcon,
    label: "Top trends",
    prompt: "What are the top trending feedback themes this month?",
  },
  {
    icon: UsersIcon,
    label: "User sentiment",
    prompt: "Summarize the overall user sentiment from recent feedback",
  },
  {
    icon: AlertCircleIcon,
    label: "Critical issues",
    prompt: "What are the most urgent issues users are reporting?",
  },
  {
    icon: LightbulbIcon,
    label: "Feature requests",
    prompt: "What are the most requested features?",
  },
];

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-welcome-root mx-auto flex h-full w-full max-w-[var(--thread-max-width)] flex-col items-center justify-center px-4 py-6">
      <div className="bg-muted mb-4 flex size-10 items-center justify-center rounded-lg">
        <SparklesIcon className="text-foreground size-5" />
      </div>

      <h2 className="text-foreground mb-1 text-base font-medium">
        What would you like to know?
      </h2>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        Ask about your feedback data and trends.
      </p>

      <div
        className="grid w-full max-w-md grid-cols-2 gap-2"
        role="group"
        aria-label="Suggested prompts"
      >
        {suggestedPrompts.map((item, index) => (
          <SuggestedPrompt
            key={index}
            icon={item.icon}
            label={item.label}
            prompt={item.prompt}
          />
        ))}
      </div>
    </div>
  );
};

type SuggestedPromptProps = {
  icon: LucideIcon;
  label: string;
  prompt: string;
};

const SuggestedPrompt: FC<SuggestedPromptProps> = ({ label, prompt }) => {
  const api = useAssistantApi();

  const handleClick = () => {
    const composer = api.composer();
    composer.setText(prompt);
    composer.send();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hover:bg-accent flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors"
    >
      <span className="text-foreground text-sm font-medium">{label}</span>
    </button>
  );
};

const Composer: FC = () => {
  return (
    <div className="aui-composer-wrapper from-background via-background sticky bottom-0 mx-auto mt-2 flex w-full flex-col gap-2 bg-gradient-to-t to-transparent px-2 pt-6 pb-4">
      {/* Gradient fade for scroll content */}
      <div className="to-background pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent" />

      <ComposerPrimitive.Root className="aui-composer-root border-border bg-background focus-within:ring-ring relative flex w-full flex-col overflow-hidden rounded-lg border transition-shadow focus-within:ring-1">
        <ComposerAttachments />

        <div className="flex items-end gap-1">
          {/* Attachment button */}
          <div className="shrink-0 pb-1.5 pl-1">
            <ComposerAddAttachment />
          </div>

          <ComposerPrimitive.Input
            placeholder="Ask anything about your platform's data..."
            className="aui-composer-input text-foreground placeholder:text-muted-foreground/60 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-relaxed outline-none"
            rows={1}
            autoFocus
            aria-label="Message input"
          />

          <ComposerAction />
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper flex shrink-0 items-center pr-1.5 pb-1.5">
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Button
            type="submit"
            size="icon"
            className="aui-composer-send size-8 rounded-md"
            aria-label="Send message"
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="aui-composer-cancel size-8 rounded-md"
            aria-label="Stop generating"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-3 rounded-lg border p-3 text-sm dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="aui-assistant-message-root group relative mx-auto flex w-full gap-3 py-4 text-sm last:mb-24"
        data-role="assistant"
      >
        {/* AI Avatar */}
        <div className="relative shrink-0">
          <Avatar className="size-7">
            <AvatarFallback className="bg-muted">
              <SparklesIcon className="text-foreground size-3.5" />
            </AvatarFallback>
          </Avatar>
          {/* Streaming indicator */}
          <ThreadPrimitive.If running>
            <span className="bg-foreground absolute -right-0.5 -bottom-0.5 size-2 animate-pulse rounded-full" />
          </ThreadPrimitive.If>
        </div>

        {/* Message Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-foreground text-xs font-medium">
              AI Assistant
            </span>
            <ThreadPrimitive.If running>
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[9px] font-normal"
              >
                Thinking...
              </Badge>
            </ThreadPrimitive.If>
          </div>

          <div className="aui-assistant-message-content prose prose-sm prose-neutral dark:prose-invert text-foreground max-w-none overflow-x-auto leading-relaxed">
            <MessagePrimitive.Parts
              components={{
                Text: MarkdownText,
                tools: { Fallback: ToolFallback },
              }}
            />
            <MessageError />
          </div>

          <div className="aui-assistant-message-footer mt-3 flex opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <BranchPicker />
            <AssistantActionBar />
          </div>
        </div>
      </m.div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root flex items-center gap-0.5"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton
          tooltip="Copy"
          className="hover:bg-accent size-7 rounded-md"
        >
          <MessagePrimitive.If copied>
            <CheckIcon className="size-3.5 text-green-500" />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon className="size-3.5" />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton
          tooltip="Regenerate"
          className="hover:bg-accent size-7 rounded-md"
        >
          <RefreshCwIcon className="size-3.5" />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="aui-user-message-root group relative mx-auto flex w-full gap-3 py-4 text-sm first:mt-3 last:mb-5"
        data-role="user"
      >
        {/* Spacer for alignment */}
        <div className="min-w-8 flex-1" />

        {/* Message Content */}
        <div className="flex max-w-[85%] flex-col items-end">
          <UserMessageAttachments />

          <div className="relative">
            <div className="aui-user-message-content bg-muted rounded-2xl rounded-br-sm px-3.5 py-2">
              <MessagePrimitive.Parts />
            </div>

            {/* Action bar - appears on hover */}
            <div className="absolute top-1/2 right-full mr-2 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <UserActionBar />
            </div>
          </div>

          <BranchPicker className="aui-user-branch-picker mt-1 justify-end" />
        </div>

        {/* User Avatar */}
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-muted">
            <UserIcon className="text-muted-foreground size-3.5" />
          </AvatarFallback>
        </Avatar>
      </m.div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex items-center"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton
          tooltip="Edit"
          className="aui-user-action-edit hover:bg-accent size-7 rounded-md"
        >
          <PencilIcon className="size-3.5" />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root bg-muted ml-auto flex w-full max-w-[85%] flex-col rounded-xl">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground flex min-h-[60px] w-full resize-none bg-transparent p-4 outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
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
        "aui-branch-picker-root text-muted-foreground mr-2 -ml-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous" className="size-6">
          <ChevronLeftIcon className="size-3.5" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
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
