"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useCallback, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useFeedbackPostCount } from "@/hooks/use-feedback-post-count";
import { AskAiHeader } from "@/components/app/ask-ai/header";
import {
  ASK_AI_THREAD_HEIGHT,
  AskAiThread,
} from "@/components/app/ask-ai/thread";
import {
  clearStoredThread,
  readStoredThread,
  saveStoredThread,
} from "@/components/app/ask-ai/storage";

import { useAiAdmin, AiNextAction } from "@/components/app/ai-settings/status";
import { issueText } from "@/lib/ai-onboarding-copy";
const authHeaders = async () => ({});

/**
 * The admin's own time zone, so "what came in today" means their day and not
 * Greenwich's. Only the browser knows it, so it travels with the request.
 */
const requestBody = () => ({
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export default function AskAi() {
  // Bumped to start over. Remounting the session is what guarantees the thread,
  // the composer draft and the restored history all go at once — a reset that
  // leaves one of the three behind is worse than none.
  const { status, unavailable } = useAiAdmin();
  const [session, setSession] = useState(0);

  // Three states, and the welcome says something different for each: undefined
  // while it loads, null when it could not be read, a number when it is known.
  const {
    query: { data, isError },
  } = useFeedbackPostCount();
  const postCount = isError ? null : data;

  const startNewChat = useCallback(() => {
    clearStoredThread();
    setSession((current) => current + 1);
  }, []);

  const available = !!status?.chatAvailable && !unavailable;
  return (
    <>
      {!available && (
        <section className="space-y-3">
          <h2 className="h5">Ask AI</h2>
          <p>
            Ask questions about your{" "}
            {typeof postCount === "number"
              ? Math.min(300, postCount)
              : "up to 300"}{" "}
            most recent posts, with links to the feedback behind each answer.
          </p>
          {status?.state === "paused" && (
            <p>
              Paused until{" "}
              {new Date(status.budget.resetAt).toLocaleTimeString()}.
            </p>
          )}
          {status?.state === "attention" && <p>{issueText(status.reason)}</p>}
          {!unavailable && <AiNextAction />}
        </section>
      )}
      <div hidden={!available} inert={!available}>
        <AskAiSession
          key={session}
          postCount={postCount}
          onNewChat={startNewChat}
        />
      </div>
    </>
  );
}

function AskAiSession({
  postCount,
  onNewChat,
}: {
  postCount: number | null | undefined;
  onNewChat: () => void;
}) {
  const [restoredMessages] = useState(readStoredThread);

  const [transport] = useState(
    () =>
      new AssistantChatTransport({
        headers: authHeaders,
        body: requestBody,
      }),
  );

  const runtime = useChatRuntime({
    transport,
    messages: restoredMessages,
    onFinish: ({ messages }) => saveStoredThread(messages),
  });

  // The restored thread comes out of sessionStorage, which the server cannot
  // read — so rendering it on the first pass would make the server's HTML and
  // the client's disagree, and React does not repair that. Waiting a tick keeps
  // this component correct on its own, rather than relying on the page above it
  // happening to hold it back until auth resolves.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskAiHeader onNewChat={onNewChat} />
      {mounted ? (
        <AskAiThread postCount={postCount} />
      ) : (
        <AskAiThreadPlaceholder />
      )}
    </AssistantRuntimeProvider>
  );
}

/** Holds the thread's space for the one render before mount. */
function AskAiThreadPlaceholder() {
  return (
    <div
      className={cn(
        "bg-background border-border w-full rounded-lg border shadow-xs",
        ASK_AI_THREAD_HEIGHT,
      )}
    />
  );
}
