"use client";

import AskAI from "@/components/app/ask-ai";
import { AskAILoading } from "@/components/app/ask-ai/loading";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";

export default function AskAIPage() {
  const { isAdmin } = useAuth();

  const {
    query: { data: org, isPending },
  } = useOrg();

  if (!isAdmin) return null;
  if (isPending) return <AskAILoading />;
  if (!org?.id) return null;

  return <AskAI orgId={org.id} />;
}
