"use client";

import AskAi from "@/components/app/ask-ai";
import { AskAiLoading } from "@/components/app/ask-ai/loading";
import { useAuth } from "@/hooks/use-auth";

export default function AskAiPage() {
  const { isAdmin, isLoaded, session } = useAuth();

  // No wait on the board: the chat resolves it server-side from the caller's own
  // token, so all this page needs to know is who is asking.
  if (!isLoaded) return <AskAiLoading />;
  if (!isAdmin || !session) return null;

  return <AskAi key={session.session.id} sessionId={session.session.id} />;
}
