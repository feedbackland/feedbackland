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
    <div className="mb-4 flex flex-col gap-3">
      <ActivityCategoryFilter
        value={category}
        unseenCounts={unseenCounts}
        commentsDisabled={status !== null}
        onChange={handleCategory}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Toggle
          variant="outline"
          pressed={unseenOnly}
          onPressedChange={handleUnseen}
          aria-label="Show unseen only"
          className="group/unseen data-[state=on]:border-primary data-[state=on]:bg-accent self-start px-3 sm:self-auto"
        >
          <span
            aria-hidden
            className="size-2 rounded-full bg-muted-foreground/40 transition-colors group-data-[state=on]/unseen:bg-blue-600 dark:group-data-[state=on]/unseen:bg-blue-500"
          />
          Unseen only
        </Toggle>

        <div className="flex items-center gap-2">
          <SortingFilteringDropdown
            orderBy={orderBy}
            status={status}
            onChange={handleSortingFiltering}
            variant="outline"
          />
          <ActivityFeedSearchInput
            onDebouncedChange={handleSearch}
            className="w-full sm:w-64"
          />
        </div>
      </div>
    </div>
  );
}
