"use client";

import { useState } from "react";
import {
  FeedbackCategories,
  FeedbackOrderBy,
  FeedbackStatus,
} from "@/lib/typings";
import { useSearchActivityFeed } from "@/hooks/use-search-activity-feed";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedListPagination } from "./list-pagination";
import { ActivityFeedListHeader } from "./list-header";
import { ActivityFeedListItems } from "./list-items";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";

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
  const [featureRequestsSelected, setFeatureRequestsSelected] = useState(false);
  const [bugReportsSelected, setBugReportsSelected] = useState(false);
  const [generalFeedbackSelected, setGeneralFeedbackSelected] = useState(false);
  const [commentsSelected, setCommentsSelected] = useState(false);

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  let categories = null;

  if (featureRequestsSelected) {
    categories = [...(categories || []), "feature request"];
  }
  if (bugReportsSelected) {
    categories = [...(categories || []), "bug report"];
  }
  if (generalFeedbackSelected) {
    categories = [...(categories || []), "general feedback"];
  }

  categories =
    (categories || [])?.length > 0 ? (categories as FeedbackCategories) : null;

  const excludeComments = !commentsSelected && (categories || [])?.length > 0;

  const excludeFeedback = commentsSelected && (categories || [])?.length === 0;

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
    categories,
    excludeComments,
    excludeFeedback,
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
    categories,
    excludeComments,
    excludeFeedback,
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
        <div className="mt-2 mb-4 grid grid-cols-4 gap-3">
          {[
            {
              title: "Feature requests",
              totalCount: metaData?.totalFeatureRequestPostCount || 0,
              newCount: metaData?.unseenFeatureRequestPostCount || 0,
            },
            {
              title: "Bug reports",
              totalCount: metaData?.totalBugReportPostCount || 0,
              newCount: metaData?.unseenBugReportPostCount || 0,
            },
            {
              title: "General feedback",
              totalCount: metaData?.totalGeneralFeedbackPostCount || 0,
              newCount: metaData?.unseenGeneralFeedbackPostCount || 0,
            },
            {
              title: "Comments",
              totalCount: metaData?.totalCommentCount || 0,
              newCount: metaData?.unseenCommentCount || 0,
            },
          ].map((stat, index) => (
            <Card
              key={index}
              className={cn(
                "border-border hover:border-primary flex cursor-pointer flex-col justify-between gap-0 rounded-md p-3 shadow-xs",
                stat.title === "Feature requests" &&
                  featureRequestsSelected &&
                  "border-primary ring-ring bg-muted/50 ring-1",
                stat.title === "Bug reports" &&
                  bugReportsSelected &&
                  "border-primary ring-ring bg-muted/50 ring-1",
                stat.title === "General feedback" &&
                  generalFeedbackSelected &&
                  "border-primary ring-ring bg-muted/50 ring-1",
                stat.title === "Comments" &&
                  commentsSelected &&
                  "border-primary ring-ring bg-muted/50 ring-1",
              )}
              onClick={() => {
                if (stat.title === "Feature requests") {
                  setFeatureRequestsSelected((prev) => !prev);
                } else if (stat.title === "Bug reports") {
                  setBugReportsSelected((prev) => !prev);
                } else if (stat.title === "General feedback") {
                  setGeneralFeedbackSelected((prev) => !prev);
                } else if (stat.title === "Comments") {
                  setCommentsSelected((prev) => !prev);
                }
              }}
            >
              <CardHeader className="text-primary p-0 text-xs font-normal">
                {stat.title}
              </CardHeader>
              <CardContent className="flex items-baseline gap-1.5 p-0">
                <span className="text-xl font-bold">{stat.totalCount}</span>
                {stat.newCount !== undefined && stat.newCount > 0 && (
                  <span className="text-xs font-normal">
                    ({stat.newCount} new)
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="border-border overflow-hidden rounded-md border">
          <ActivityFeedListHeader
            className="bg-background border-border border-b py-2 pr-3 pl-4"
            onChange={({ searchValue, orderBy, status }) => {
              setPage(1);
              setSearchValue(searchValue);
              setOrderBy(orderBy);
              setStatus(status);
            }}
          />

          <div className="flex flex-col items-stretch">
            {showItems && <ActivityFeedListItems items={items} />}

            {isPending && <ActivityFeedLoading />}

            {isError && (
              <div className="py-4 text-center text-red-500">
                Error loading inbox
              </div>
            )}

            {isPlatformEmpty && (
              <div className="text-muted-foreground space-y-1 py-5 text-center">
                <div className="text-sm font-normal">No content found</div>
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
