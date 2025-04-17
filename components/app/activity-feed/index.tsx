"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { useSearchActivityFeed } from "@/hooks/use-search-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedSearchInput } from "./search-input";
import { ActivityFeedLoading } from "./loading";

const PAGE_SIZE = 2;

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
  const count = Number(activeData?.count ?? 0); // Ensure count is a number
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

  const getDropdownName = () => {
    let orderByName = "Newest";

    if (orderBy === "upvotes") {
      orderByName = "Most upvoted";
    } else if (orderBy === "comments") {
      orderByName = "Most commented";
    }

    return (
      <>
        {orderByName}
        {status && ", "}
        {status && (
          <div className={cn(`text-${status.replace(" ", "-")}`)}>
            {capitalizeFirstLetter(status)}
          </div>
        )}
      </>
    );
  };

  const handleSelectStatus = (value: FeedbackStatus | "all") => {
    if (value === "all") {
      setStatus(null);
    } else {
      setStatus(value);
    }
  };

  const startItem = count > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const endItem = Math.min(currentPage * PAGE_SIZE, count);

  return (
    <div className="mt-10">
      {!isPlatformEmpty && (
        <div className="relative mb-3 flex h-[40px] items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="link"
                className="text-muted-foreground hover:text-primary h-auto p-0 hover:no-underline"
              >
                {getDropdownName()}
                <ChevronDown className="size-3.5!" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={orderBy}
                onValueChange={(value) => setOrderBy(value as FeedbackOrderBy)}
              >
                <DropdownMenuRadioItem value="newest">
                  Newest
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="upvotes">
                  Most upvoted
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comments">
                  Most commented
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />

              <DropdownMenuRadioGroup
                value={status || "all"}
                onValueChange={(value) =>
                  handleSelectStatus(value as FeedbackStatus | "all")
                }
              >
                <DropdownMenuRadioItem value="all">
                  All statuses
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="under consideration"
                  className="text-under-consideration"
                >
                  Under consideration
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="planned" className="text-planned">
                  Planned
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="in progress"
                  className="text-in-progress"
                >
                  In progress
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="done" className="text-done">
                  Done
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="declined"
                  className="text-declined"
                >
                  Declined
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

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
          {items?.map(({ id, content }) => <div key={id}>{content}</div>)}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                Showing {startItem}-{endItem} of {count} items
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage - 1);
                      }}
                      aria-disabled={currentPage === 1}
                      tabIndex={currentPage === 1 ? -1 : undefined}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>

                  {/* Simplified pagination links for brevity - consider adding ellipsis logic if needed */}
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Basic logic to show first, last, current, and adjacent pages
                    const showPage =
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 &&
                        pageNum <= currentPage + 1);

                    if (!showPage) {
                      // Add ellipsis logic here if desired
                      // Render ellipsis only once between gaps
                      if (
                        (pageNum === 2 && currentPage > 3) ||
                        (pageNum === totalPages - 1 &&
                          currentPage < totalPages - 2)
                      ) {
                        return (
                          <PaginationItem key={`ellipsis-${pageNum}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    }

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(pageNum);
                          }}
                          isActive={currentPage === pageNum}
                          aria-current={
                            currentPage === pageNum ? "page" : undefined
                          }
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage + 1);
                      }}
                      aria-disabled={currentPage === totalPages}
                      tabIndex={currentPage === totalPages ? -1 : undefined}
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
