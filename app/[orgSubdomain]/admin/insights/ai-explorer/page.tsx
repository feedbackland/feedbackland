"use client";

import AskAI from "@/components/app/ask-ai";
import { useOrg } from "@/hooks/use-org";

export default function AIExplorerPage() {
  const {
    query: { data: org },
  } = useOrg();

  if (org && org.id) {
    return <AskAI orgId={org.id} />;
  }
}
