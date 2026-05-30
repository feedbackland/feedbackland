"use client";

import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import { FeedbackCategories } from "@/lib/typings";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useInView } from "react-intersection-observer";
import { Spinner } from "@/components/ui/spinner";
import { Error } from "@/components/ui/error";
import { ActivityFeedListItems } from "./list-items";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedEmpty } from "./empty";

export function ActivityFeedList() {
  const [state, setState] = useAtom(activtyFeedStateAtom);
  const { category, orderBy, status, searchValue, unseenOnly } = state;

  const isSearchActive = searchValue.length > 0;

  // Map the single-select category onto the existing query params.
  let categories: FeedbackCategories = null;
  let excludeComments = false;
  let excludeFeedback = false;

  if (category === "comments") {
    excludeFeedback = true;
  } else if (category !== "all") {
    categories = [category];
    excludeComments = true;
  }

  const {
    query: {
      data,
      isPending,
      isError,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    },
  } = useActivityFeed({
    enabled: true,
    pageSize: 20,
    orderBy,
    status,
    categories,
    excludeComments,
    excludeFeedback,
    searchValue,
    unseenOnly,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const isLoaded = !isPending && !isError;
  const hasItems = items.length > 0;
  const isEmpty = isLoaded && !hasItems;
  const hasFilter = category !== "all" || status !== null;

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  const resetSearch = () => setState((prev) => ({ ...prev, searchValue: "" }));
  const resetUnseen = () =>
    setState((prev) => ({ ...prev, unseenOnly: false }));
  const resetFilters = () =>
    setState((prev) => ({ ...prev, category: "all", status: null }));

  return (
    <div className="border-border bg-background overflow-hidden rounded-lg border shadow-xs">
      {isPending && <ActivityFeedLoading />}

      {isError && (
        <div className="p-4">
          <Error
            title="Could not load activity"
            description="Something went wrong while loading the activity feed. Please try again."
          />
        </div>
      )}

      {isEmpty && isSearchActive && (
        <ActivityFeedEmpty variant="search" onReset={resetSearch} />
      )}
      {isEmpty && !isSearchActive && unseenOnly && (
        <ActivityFeedEmpty variant="caught-up" onReset={resetUnseen} />
      )}
      {isEmpty && !isSearchActive && !unseenOnly && hasFilter && (
        <ActivityFeedEmpty variant="filter" onReset={resetFilters} />
      )}
      {isEmpty && !isSearchActive && !unseenOnly && !hasFilter && (
        <ActivityFeedEmpty variant="platform" />
      )}

      {isLoaded && hasItems && (
        <>
          <ActivityFeedListItems items={items} />
          <span className="sr-only" aria-live="polite">
            {isFetchingNextPage ? "Loading more activity" : ""}
          </span>
          {isFetchingNextPage && (
            <div className="border-border text-muted-foreground flex items-center justify-start gap-2 border-t p-4">
              <Spinner />
              <span className="text-sm">Loading more activity...</span>
            </div>
          )}
          <div ref={ref} className="h-1 w-full" />
        </>
      )}
    </div>
  );
}
