"use client";

import { useState } from "react";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { useSearchActivityFeed } from "@/hooks/use-search-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedListPagination } from "./list-pagination";
import { ActivityFeedListHeader } from "./list-header";
import { ActivityFeedListItems } from "./list-items";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export function ActivityFeedList({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState<FeedbackOrderBy>("newest");
  const [status, setStatus] = useState<FeedbackStatus>(null);

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: {
      data: itemsData,
      isPending: isItemsPending,
      isError: isItemsError,
    },
  } = useActivityFeed({
    enabled: !isSearchActive,
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    status,
  });

  const {
    query: {
      data: searchData,
      isPending: isSearchPending,
      isError: isSearchError,
    },
  } = useSearchActivityFeed({
    searchValue,
    enabled: isSearchActive,
    page,
    pageSize: PAGE_SIZE,
  });

  const activeData = isSearchActive ? searchData : itemsData;
  const items = activeData?.items;
  const totalPages = activeData?.totalPages ?? 1;
  const currentPage = activeData?.currentPage ?? 1;
  const isPending = isSearchActive ? isSearchPending : isItemsPending;
  const isError = isSearchActive ? isSearchError : isItemsError;
  const isLoaded = !isPending && !isError;
  const hasItems = !!(items && items.length > 0);
  const hasNoItems = isLoaded && !hasItems;
  const hasStatusFilter = status !== null;
  const isPlatformEmpty =
    isLoaded && !isSearchActive && !hasStatusFilter && hasNoItems;
  const isSearchEmpty = isLoaded && isSearchActive && hasNoItems;
  const isStatusEmpty =
    isLoaded &&
    !isSearchActive &&
    !isPlatformEmpty &&
    hasStatusFilter &&
    hasNoItems;
  const showItems =
    !isError && !isPlatformEmpty && !isSearchEmpty && !isStatusEmpty;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo(0, 0); // Scroll to top when page changes
    }
  };

  return (
    <>
      <div className={cn("", className)}>
        <ActivityFeedListHeader
          className="border-border bg-muted/50 rounded-t-md border px-4 py-2"
          onChange={({ searchValue, orderBy, status }) => {
            setPage(1);
            setSearchValue(searchValue);
            setOrderBy(orderBy);
            setStatus(status);
          }}
        />

        <div className="border-border flex flex-col items-stretch rounded-b-md border">
          {showItems && <ActivityFeedListItems items={items} />}

          {isPending && <ActivityFeedLoading />}

          {isError && (
            <div className="py-4 text-center text-red-500">
              Error loading inbox
            </div>
          )}

          {isPlatformEmpty && (
            <div className="text-muted-foreground space-y-1 py-5 text-center">
              <div className="text-base font-semibold">No content found</div>
            </div>
          )}

          {isSearchEmpty && (
            <div className="text-muted-foreground py-5 text-center text-sm font-normal">
              No matches found for your search
            </div>
          )}

          {isStatusEmpty && (
            <div className="text-muted-foreground py-5 text-center text-sm font-normal">
              No feedback found that is marked as {status}
            </div>
          )}
        </div>
      </div>

      {showItems && (
        <ActivityFeedListPagination
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}
    </>
  );
}
