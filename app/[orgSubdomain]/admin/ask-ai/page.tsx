"use client";

import { useOrg } from "@/hooks/use-org";
import AskAI from "@/components/app/ask-ai";

export default function AdminAskAIPage() {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org?.id) {
    return <AskAI orgId={org.id} />;
  }

  return null;
}
