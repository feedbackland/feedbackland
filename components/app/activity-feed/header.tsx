"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSetAllActivitiesSeen } from "@/hooks/use-set-all-activities-seen";
import { Check, CheckCheck } from "lucide-react";

export function ActivityFeedHeader({ unseenCount }: { unseenCount: number }) {
  const [isDone, setIsDone] = useState(false);
  const markAllSeen = useSetAllActivitiesSeen();

  const hasUnseen = unseenCount > 0;

  const handleClick = async () => {
    await markAllSeen.mutateAsync();
    setIsDone(true);
    setTimeout(() => setIsDone(false), 2500);
  };

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="h5">Activity</h2>

      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        loading={markAllSeen.isPending}
        disabled={!hasUnseen && !isDone}
        className="shrink-0 gap-1.5"
      >
        {isDone ? (
          <>
            <Check className="size-4" /> Done
          </>
        ) : (
          <>
            <CheckCheck className="size-4" /> Mark all as read
          </>
        )}
      </Button>
    </div>
  );
}
