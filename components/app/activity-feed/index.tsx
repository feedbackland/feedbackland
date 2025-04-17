"use client";

import { useState } from "react";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { useSearchActivityFeed } from "@/hooks/use-search-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedSearchInput } from "./search-input";
import { ActivityFeedLoading } from "./loading";
import parse from "html-react-parser";
import sanitizeHtml, { defaults as sanitizeHtmlDefaults } from "sanitize-html";
import { ActivityFeedPagination } from "./pagination";
import { ActivityFeedSortingFilteringDropdown } from "./sorting-filtering-dropdown";

const PAGE_SIZE = 1;

export function ActivityFeed() {
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState<FeedbackOrderBy>("newest");
  const [status, setStatus] = useState<FeedbackStatus>(null);

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: { data, isPending: isItemsPending, isError: isItemsError },
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
  const activeData = isSearchActive ? searchData : data;
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

  const handleSearch = (value: string) => {
    setPage(1);
    setSearchValue(value);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo(0, 0); // Scroll to top when page changes
    }
  };

  return (
    <div className="mt-10">
      {!isPlatformEmpty && (
        <div className="relative mb-3 flex h-[40px] items-center justify-between gap-2">
          <ActivityFeedSortingFilteringDropdown
            orderBy={orderBy}
            status={status}
            onChange={({ orderBy, status }) => {
              setOrderBy(orderBy);
              setStatus(status);
            }}
          />

          <ActivityFeedSearchInput onDebouncedChange={handleSearch} />
        </div>
      )}

      {isPending && <ActivityFeedLoading />}

      {isError && (
        <div className="py-4 text-center text-red-500">Error loading inbox</div>
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

      {isLoaded &&
        !isSearchActive &&
        !isPlatformEmpty &&
        hasStatusFilter &&
        hasNoItems && (
          <div className="text-muted-foreground py-5 text-center text-sm font-normal">
            No feedback found that is marked as {status}
          </div>
        )}

      {isLoaded && hasItems && (
        <div className="space-y-8">
          {totalPages > 1 && (
            <ActivityFeedPagination
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          )}

          {items?.map(({ id, content }) => (
            <div key={id}>
              {" "}
              <div className="tiptap-output text-primary">
                {parse(
                  sanitizeHtml(content, {
                    allowedTags: sanitizeHtmlDefaults.allowedTags.filter(
                      (tag) => tag !== "a" && tag !== "code",
                    ),
                  }),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
