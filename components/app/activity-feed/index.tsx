"use client";

import { ActivityFeedList } from "./list";
import { Button } from "@/components/ui/button";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { useSetAllActivitiesSeen } from "@/hooks/use-set-all-activities-seen";
import { SubscriptionPostLimitAlert } from "@/components/app/subscription/post-limit-alert";
import { BookOpenCheckIcon } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export function ActivityFeed() {
  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  const allActivitiesSeen = useSetAllActivitiesSeen();

  return (
    <div className="">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="h4">Activity</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled={metaData?.totalUnseenCount === 0}
              loading={allActivitiesSeen.isPending}
              onClick={() => {
                allActivitiesSeen.mutate();
              }}
              variant="outline"
              size="icon"
            >
              <BookOpenCheckIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark all as read</TooltipContent>
        </Tooltip>
      </div>
      <SubscriptionPostLimitAlert className="-mt-3 mb-4" />
      <ActivityFeedList />
    </div>
  );
}
