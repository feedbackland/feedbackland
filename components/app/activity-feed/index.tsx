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
import { ChevronDown } from "lucide-react";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import { useSearchActivityFeed } from "@/hooks/use-search-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedSearchInput } from "./search-input";
import { ActivityFeedLoading } from "./loading";

export function ActivityFeed() {
  const [searchValue, setSearchValue] = useState("");
  const [orderBy, setOrderBy] = useState<FeedbackOrderBy>("newest");
  const [status, setStatus] = useState<FeedbackStatus>(null);

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: {
      data: postsData,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending: isPostsPending,
      isError: isPostsError,
    },
  } = useActivityFeed({ enabled: !isSearchActive, orderBy, status });

  const {
    query: {
      data: searchData,
      isPending: isSearchPending,
      isError: isSearchError,
    },
  } = useSearchActivityFeed({
    searchValue,
    enabled: isSearchActive,
  });

  const posts =
    (isSearchActive
      ? searchData
      : postsData?.pages.flatMap((page) => page.data)) || [];
  const isPending = isSearchActive ? isSearchPending : isPostsPending;
  const isError = isSearchActive ? isSearchError : isPostsError;

  const isPlatformEmpty =
    !isPending &&
    !isSearchActive &&
    !isError &&
    status === null &&
    posts.length === 0;

  const isSearchEmpty =
    !isPending && isSearchActive && !isError && posts.length === 0;

  const handleSearch = (value: string) => {
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
                  Most upvotes
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comments">
                  Most comments
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
        <div className="py-4 text-center text-red-500">Error loading posts</div>
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

      {!isPending &&
        !isError &&
        !isPlatformEmpty &&
        !isSearchEmpty &&
        status !== null &&
        posts.length === 0 && (
          <div className="text-muted-foreground py-5 text-center text-sm font-normal">
            No feedback found that is marked as {status}
          </div>
        )}

      {!!(!isPending && !isError && posts.length > 0) && (
        <div className="space-y-8">
          {posts.map((post) => (
            <div key={post.id}>{post.content}</div>
          ))}
        </div>
      )}
    </div>
  );
}
