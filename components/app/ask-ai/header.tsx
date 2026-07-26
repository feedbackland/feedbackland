"use client";

import { useAuiState } from "@assistant-ui/react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What the page is for, stated the same way every time you land on it — the same
 * shape as the Insights header, because these are siblings and an admin should
 * not have to re-learn where the title lives.
 *
 * The second sentence is the one that matters. It is the promise the rest of the
 * page is built to keep, and saying it once here is what lets every answer get
 * away with a three-word "Sources" label instead of explaining itself again.
 *
 * The action only appears once there is a conversation to leave behind. On a
 * fresh thread it would be a button that does nothing.
 */
export function AskAiHeader({ onNewChat }: { onNewChat: () => void }) {
  const hasMessages = useAuiState((state) => state.thread.messages.length > 0);

  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="h5">Ask AI</h2>
        <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-normal">
          Ask anything about your feedback. Every answer links back to the posts
          behind it.
        </p>
      </div>

      {hasMessages && (
        <Button variant="outline" onClick={onNewChat} className="shrink-0">
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
      )}
    </div>
  );
}
