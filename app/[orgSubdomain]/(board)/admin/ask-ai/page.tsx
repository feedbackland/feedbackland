"use client";

import AskAi from "@/components/app/ask-ai";
import { AskAiLoading } from "@/components/app/ask-ai/loading";
import { useAuth } from "@/hooks/use-auth";

export default function AskAiPage() {
  const { isAdmin, isLoaded } = useAuth();

  // No wait on the org: the chat resolves it server-side from the caller's own
  // token, so all this page needs to know is who is asking.
  if (!isLoaded) return <AskAiLoading />;
  if (!isAdmin) return null;

  return <AskAi />;
}
