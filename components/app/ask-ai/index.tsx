"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/ui/assistant-ui/thread";

export default function AskAI({ orgId }: { orgId: string }) {
  const transport = new AssistantChatTransport({
    body: {
      orgId,
    },
  });

  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <h2 className="h5 mb-5 flex flex-wrap items-center gap-2">Ask AI</h2>
      <div className="border-border w-full overflow-hidden rounded-lg border shadow-xs">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
