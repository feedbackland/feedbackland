"use client";

import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { ActivityCategory, ActivityCategoryFilter } from "./category-filter";
import { ActivityFeedSearchInput } from "./search-input";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";
import { Toggle } from "@/components/ui/toggle";

export function ActivityFeedToolbar({
  counts,
  unseen,
}: {
  counts: Record<ActivityCategory, number>;
  unseen: Record<ActivityCategory, boolean>;
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
        counts={counts}
        unseen={unseen}
        commentsDisabled={status !== null}
        onChange={handleCategory}
      />

      <div className="flex items-center justify-between gap-2">
        <Toggle
          variant="outline"
          size="sm"
          pressed={unseenOnly}
          onPressedChange={handleUnseen}
          aria-label="Show unseen only"
          className="shrink-0"
        >
          Unseen only
        </Toggle>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <SortingFilteringDropdown
            orderBy={orderBy}
            status={status}
            onChange={handleSortingFiltering}
          />
          <ActivityFeedSearchInput onDebouncedChange={handleSearch} />
        </div>
      </div>
    </div>
  );
}
