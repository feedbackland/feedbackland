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

  const counts: Record<ActivityCategory, number> = {
    all:
      (metaData?.totalIdeasPostCount ?? 0) +
      (metaData?.totalIssuesPostCount ?? 0) +
      (metaData?.totalGeneralFeedbackPostCount ?? 0) +
      (metaData?.totalCommentCount ?? 0),
    idea: metaData?.totalIdeasPostCount ?? 0,
    issue: metaData?.totalIssuesPostCount ?? 0,
    "general feedback": metaData?.totalGeneralFeedbackPostCount ?? 0,
    comments: metaData?.totalCommentCount ?? 0,
  };

  const unseen: Record<ActivityCategory, boolean> = {
    all: totalUnseen > 0,
    idea: (metaData?.unseenIdeasPostCount ?? 0) > 0,
    issue: (metaData?.unseenIssuesPostCount ?? 0) > 0,
    "general feedback": (metaData?.unseenGeneralFeedbackPostCount ?? 0) > 0,
    comments: (metaData?.unseenCommentCount ?? 0) > 0,
  };

  return (
    <div>
      <ActivityFeedHeader unseenCount={totalUnseen} />
      <ActivityFeedToolbar counts={counts} unseen={unseen} />
      <ActivityFeedList />
    </div>
  );
}
