"use client";

import AskAI from "@/components/app/ask-ai";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";

export default function AskAIPage() {
  const { isAdmin } = useAuth();

  const {
    query: { data: org },
  } = useOrg();

  if (isAdmin && org?.id) {
    return <AskAI orgId={org.id} />;
  }

  return null;
}
