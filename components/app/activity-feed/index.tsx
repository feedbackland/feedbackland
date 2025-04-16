"use client";

import { useActivityFeed } from "@/hooks/use-activity-feed";

export function ActivityFeed() {
  const {
    query: { data },
  } = useActivityFeed({ enabled: true });

  console.log(data);

  return null;
}
