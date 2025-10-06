"use client";

import { ActivityFeedList } from "./list";
import { Button } from "@/components/ui/button";
import { useSetAllActivitiesSeen } from "@/hooks/use-set-all-activities-seen";
import { BookOpenIcon, CheckIcon } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useState } from "react";

export function ActivityFeed() {
  const [isCompleted, setIsCompleted] = useState(false);

  const allActivitiesSeen = useSetAllActivitiesSeen();

  const handleOnCLick = async () => {
    await allActivitiesSeen.mutateAsync();
    setIsCompleted(true);
    setTimeout(() => setIsCompleted(false), 3000);
  };

  return (
    <div className="">
      <div className="-mt-1 mb-5 flex items-center justify-between">
        <h2 className="h5">Activity</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              loading={allActivitiesSeen.isPending}
              onClick={handleOnCLick}
              variant="outline"
              size="icon"
            >
              {isCompleted ? <CheckIcon /> : <BookOpenIcon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark all as read</TooltipContent>
        </Tooltip>
      </div>
      <ActivityFeedList />
    </div>
  );
}
