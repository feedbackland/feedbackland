"use client";

import { ActivityFeedList } from "./list";
import { Button } from "@/components/ui/button";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { useSetAllActivitiesSeen } from "@/hooks/use-set-all-activities-seen";
import { SubscriptionPostLimitAlert } from "@/components/app/subscription/post-limit-alert";

export function ActivityFeed() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const allActivitiesSeen = useSetAllActivitiesSeen();

  return (
    <div className="">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="h4">Activity</h2>
        {metaData && metaData?.totalUnseenCount > 0 && (
          <Button
            disabled={metaData?.totalUnseenCount === 0}
            loading={allActivitiesSeen.isPending}
            onClick={() => {
              allActivitiesSeen.mutate();
            }}
          >
            Mark all as read
          </Button>
        )}
      </div>
      <SubscriptionPostLimitAlert className="-mt-4 mb-4" />
      <ActivityFeedList />
    </div>
  );
}
