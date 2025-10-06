"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/ui/assistant-ui/thread";

export default function AskAI({ orgId }: { orgId: string }) {
  console.log("orgId", orgId);

  const transport = new AssistantChatTransport({
    body: {
      orgId,
    },
  });

  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="border-border w-full border">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
