"use client";

import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { ActivityFeedHeader } from "./header";
import { ActivityFeedToolbar } from "./toolbar";
import { ActivityFeedList } from "./list";
import { ActivityCategory } from "./category-filter";

export function ActivityFeed() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const totalUnseen = metaData?.totalUnseenCount ?? 0;

  const unseenCounts: Record<ActivityCategory, number> = {
    all: totalUnseen,
    idea: metaData?.unseenIdeasPostCount ?? 0,
    issue: metaData?.unseenIssuesPostCount ?? 0,
    "general feedback": metaData?.unseenGeneralFeedbackPostCount ?? 0,
    comments: metaData?.unseenCommentCount ?? 0,
  };

  return (
    <div>
      <ActivityFeedHeader unseenCount={totalUnseen} />
      <ActivityFeedToolbar unseenCounts={unseenCounts} />
      <ActivityFeedList />
    </div>
  );
}
