"use client";

import { ActivityFeedList } from "./list";
import { Button } from "@/components/ui/button";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { useSetAllActivitiesSeen } from "@/hooks/use-set-all-activities-seen";

export function ActivityFeed() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const allActivitiesSeen = useSetAllActivitiesSeen();

  return (
    <div className="pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="h3">Activity Feed</h2>
        <Button
          disabled={metaData?.totalUnseenCount === 0}
          loading={allActivitiesSeen.isPending}
          onClick={() => {
            allActivitiesSeen.mutate();
          }}
        >
          Mark all as read
        </Button>
      </div>
      <ActivityFeedList />
    </div>
  );
}
