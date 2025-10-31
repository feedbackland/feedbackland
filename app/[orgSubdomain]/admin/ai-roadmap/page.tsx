"use client";

import { Insights } from "@/components/app/insights";
import { useAuth } from "@/hooks/use-auth";

export default function AIRoadmapPage() {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return <Insights />;
  }
}
