"use client";

import { ActivityFeedList } from "./list";

export function ActivityFeed() {
  return (
    <div className="pt-4">
      <h2 className="h3 mb-4">Activity Feed</h2>
      <ActivityFeedList />
    </div>
  );
}
