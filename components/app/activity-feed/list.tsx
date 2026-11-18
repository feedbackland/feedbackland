"use client";

import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import { FeedbackCategories } from "@/lib/typings";
import { useEffect } from "react";
import { SearchState } from "../search-state";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useInView } from "react-intersection-observer";
import { Spinner } from "@/components/ui/spinner";
import { Error } from "@/components/ui/error";
import { ActivityFeedListItems } from "./list-items";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedEmpty } from "./empty";

export function ActivityFeedList() {
  const [state, setState] = useAtom(activtyFeedStateAtom);
  const { category, orderBy, status, searchValue, unseenOnly, unscreenedOnly } =
    state;

  const isSearchActive = !!searchValue.trim();

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
      error,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isFetching,
      refetch,
      errorUpdatedAt,
      isFetchNextPageError,
    },
    sessionError,
    sessionErrorAt,
    restartSearch,
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
    unscreenedOnly,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const isLoaded = !isPending && (!isError || !!(searchValue && data));
  const hasItems = items.length > 0;
  const isEmpty = isLoaded && !hasItems;
  const hasFilter = category !== "all" || status !== null || unscreenedOnly;

  const lastPage = data?.pages.at(-1);
  const { ref, inView } = useInView();
  useEffect(() => {
    const emptySearchPage = isSearchActive && lastPage?.items.length === 0;
    // Recheck when a fetch settles. The sentinel can stay visible while a page
    // is being fetched and produce no new intersection event for the next page.
    if ((inView || emptySearchPage) && hasNextPage && !isFetching && !isError)
      void fetchNextPage();
  }, [
    inView,
    isSearchActive,
    lastPage,
    hasNextPage,
    isFetching,
    isError,
    fetchNextPage,
  ]);

  const resetSearch = () => setState((prev) => ({ ...prev, searchValue: "" }));
  const resetUnseen = () =>
    setState((prev) => ({ ...prev, unseenOnly: false }));
  const resetFilters = () =>
    setState((prev) => ({
      ...prev,
      category: "all",
      status: null,
      unscreenedOnly: false,
    }));

  return (
    <div className="border-border bg-background overflow-hidden rounded-lg border shadow-xs">
      {isPending && !sessionError && <ActivityFeedLoading />}

      {isSearchActive && (
        <SearchState
          search={data?.pages[0]?.search}
          error={sessionError ?? (isError ? error : undefined)}
          errorAt={sessionErrorAt ?? errorUpdatedAt}
          onRetry={
            sessionError
              ? restartSearch
              : () => {
                  void (isFetchNextPageError ? fetchNextPage() : refetch());
                }
          }
          onRestart={restartSearch}
        />
      )}
      {isError && !isSearchActive && (
        <div className="p-4">
          <Error
            title="Could not load activity"
            description="Something went wrong while loading the activity feed. Please try again."
          />
        </div>
      )}

      {isEmpty &&
        isSearchActive &&
        !hasNextPage &&
        data?.pages[0]?.search?.status !== "pending" &&
        !isError && (
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
        </>
      )}
      {hasNextPage && !isError && <div ref={ref} className="h-1 w-full" />}
    </div>
  );
}
