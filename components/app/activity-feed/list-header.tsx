"use client";

import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { ActivityFeedSearchInput } from "./search-input";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";

export function ActivityFeedListHeader({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const [activityFeedState, setActivityFeedState] =
    useAtom(activtyFeedStateAtom);

  const { orderBy, status } = activityFeedState;

  const handleSearch = (searchValue: string) => {
    setActivityFeedState((prev) => ({
      ...prev,
      page: 1,
      searchValue,
    }));
  };

  const handleSortingFiltering = ({
    orderBy,
    status,
  }: {
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) => {
    setActivityFeedState((prev) => ({
      ...prev,
      page: 1,
      orderBy,
      status,
    }));
  };

  return (
    <div
      className={cn(
        "relative flex h-[48px] items-center justify-between gap-2",
        className,
      )}
    >
      <SortingFilteringDropdown
        orderBy={orderBy}
        status={status}
        onChange={handleSortingFiltering}
      />
      <ActivityFeedSearchInput onDebouncedChange={handleSearch} />
    </div>
  );
}
