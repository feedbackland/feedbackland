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
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { useSearchActivityFeed } from "@/hooks/use-search-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedSearchInput } from "./search-input";
import { ActivityFeedLoading } from "./loading";

const PAGE_SIZE = 10;

export function ActivityFeed() {
  const [searchValue, setSearchValue] = useState("");
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState<FeedbackOrderBy>("newest");
  const [status, setStatus] = useState<FeedbackStatus>(null);

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: { data, isPending: isPostsPending, isError: isPostsError },
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

  const items = isSearchActive ? searchData?.items : data?.items;
  const isPending = isSearchActive ? isSearchPending : isPostsPending;
  const isError = isSearchActive ? isSearchError : isPostsError;
  const isLoaded = !isPending && !isError;
  const hasNoItems = !!(items && items.length === 0);
  const hasStatusFilter = status !== null;
  const isPlatformEmpty =
    isLoaded && !isSearchActive && !hasStatusFilter && hasNoItems;
  const isSearchEmpty = isLoaded && isSearchActive && hasNoItems;

  const handleSearch = (value: string) => {
    setPage(1);
    setSearchValue(value);
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

  const goToPrevPage = () => {
    setPage((page) => page - 1);
  };

  const goToNextPage = () => {
    setPage((page) => page + 1);
  };

  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = page * PAGE_SIZE;

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

      {isLoaded && !!items && items?.length > 0 && (
        <>
          {!isSearchActive && data && (
            <div className="flex items-center justify-between">
              <div>
                {startItem}-{endItem} of {data.count}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  onClick={goToPrevPage}
                  disabled={page === 1}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button
                  size="icon"
                  onClick={goToNextPage}
                  disabled={page === data.totalPages}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-8">
            {items?.map(({ id, content }) => <div key={id}>{content}</div>)}
          </div>
        </>
      )}
    </div>
  );
}
