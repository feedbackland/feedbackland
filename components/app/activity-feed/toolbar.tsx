"use client";

import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { ActivityCategory, ActivityCategoryFilter } from "./category-filter";
import { ActivityFeedSearchInput } from "./search-input";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";
import { Toggle } from "@/components/ui/toggle";

export function ActivityFeedToolbar({
  unseenCounts,
}: {
  unseenCounts: Record<ActivityCategory, number>;
}) {
  const [state, setState] = useAtom(activtyFeedStateAtom);
  const { category, orderBy, status, unseenOnly } = state;

  const totalUnseen = unseenCounts.all ?? 0;

  const handleCategory = (next: ActivityCategory) =>
    setState((prev) => ({ ...prev, category: next }));

  const handleUnseen = (pressed: boolean) =>
    setState((prev) => ({ ...prev, unseenOnly: pressed }));

  const handleSearch = (searchValue: string) =>
    setState((prev) => ({ ...prev, searchValue }));

  const handleSortingFiltering = ({
    orderBy,
    status,
  }: {
    orderBy: FeedbackOrderBy;
    status: FeedbackStatus;
  }) =>
    setState((prev) => ({
      ...prev,
      orderBy,
      status,
      // status is a post concept; leaving "comments" selected while a status
      // is active would be contradictory, so fall back to "all".
      category: status && prev.category === "comments" ? "all" : prev.category,
    }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Toggle
        variant="outline"
        pressed={unseenOnly}
        onPressedChange={handleUnseen}
        aria-label="Show unseen only"
        className="order-1 gap-2 px-3 data-[state=on]:border-blue-200 data-[state=on]:bg-blue-50 data-[state=on]:text-blue-700 dark:data-[state=on]:border-blue-900 dark:data-[state=on]:bg-blue-950 dark:data-[state=on]:text-blue-300"
      >
        Unseen
        {totalUnseen > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium tabular-nums text-white dark:bg-blue-500">
            {totalUnseen}
          </span>
        )}
      </Toggle>

      <ActivityFeedSearchInput
        onDebouncedChange={handleSearch}
        className="order-last min-w-0 sm:order-2 sm:w-auto sm:flex-1"
      />

      <ActivityCategoryFilter
        value={category}
        unseenCounts={unseenCounts}
        commentsDisabled={status !== null}
        onChange={handleCategory}
        className="order-2 flex-1 sm:order-3 sm:flex-none"
      />

      <SortingFilteringDropdown
        orderBy={orderBy}
        status={status}
        onChange={handleSortingFiltering}
        variant="outline"
        className="order-3 sm:order-4"
      />
    </div>
  );
}
