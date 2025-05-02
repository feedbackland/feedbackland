"use client";

import { useState } from "react";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { ActivityFeedSearchInput } from "./search-input";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";
import { cn } from "@/lib/utils";

export function ActivityFeedListHeader({
  onChange,
  className,
}: {
  onChange: ({
    searchValue,
    orderBy,
    status,
  }: {
    searchValue: string;
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) => void;
  className?: React.ComponentProps<"div">["className"];
}) {
  const [state, setState] = useState<{
    searchValue: string;
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }>({
    searchValue: "",
    orderBy: "newest",
    status: null,
  });

  const handleSearch = (searchValue: string) => {
    const newState = { ...state, searchValue };
    setState(newState);
    onChange(newState);
  };

  const handleSortingFiltering = ({
    orderBy,
    status,
  }: {
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) => {
    const newState = { ...state, orderBy, status };
    setState(newState);
    onChange(newState);
  };

  return (
    <div
      className={cn(
        "relative flex h-[54px] items-center justify-between gap-2",
        className,
      )}
    >
      <SortingFilteringDropdown
        orderBy={state.orderBy}
        status={state.status}
        onChange={handleSortingFiltering}
      />
      <ActivityFeedSearchInput onDebouncedChange={handleSearch} />
    </div>
  );
}
