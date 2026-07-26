"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { getIdToken } from "firebase/auth";
import { useCallback, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { getSubdomain } from "@/lib/utils";
import { useFeedbackPostCount } from "@/hooks/use-feedback-post-count";
import { AskAiHeader } from "@/components/app/ask-ai/header";
import { AskAiThread } from "@/components/app/ask-ai/thread";
import {
  clearStoredThread,
  readStoredThread,
  saveStoredThread,
} from "@/components/app/ask-ai/storage";

/**
 * `/api/chat` reads a whole board and spends the deployment's model budget, so
 * it authenticates exactly as every tRPC procedure does — the caller's own token
 * plus the subdomain they are on. The org is never sent in the body: whoever is
 * asking has to be an admin of the board they are asking about.
 */
const authHeaders = async (): Promise<Record<string, string>> => {
  await auth.authStateReady();

  const idToken = auth.currentUser ? await getIdToken(auth.currentUser) : null;
  const subdomain = getSubdomain();

  return {
    ...(!!idToken && { Authorization: `Bearer ${idToken}` }),
    ...(!!subdomain && { subdomain }),
  };
};

export default function AskAi() {
  // Bumped to start over. Remounting the session is what guarantees the thread,
  // the composer draft and the restored history all go at once — a reset that
  // leaves one of the three behind is worse than none.
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

  return (
    <AskAiSession
      key={session}
      postCount={postCount}
      onNewChat={startNewChat}
    />
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
    () => new AssistantChatTransport({ headers: authHeaders }),
  );

  const runtime = useChatRuntime({
    transport,
    messages: restoredMessages,
    onFinish: ({ messages }) => saveStoredThread(messages),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskAiHeader onNewChat={onNewChat} />
      <AskAiThread postCount={postCount} />
    </AssistantRuntimeProvider>
  );
}
