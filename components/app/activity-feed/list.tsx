"use client";

import { FeedbackCategories } from "@/lib/typings";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedListPagination } from "./list-pagination";
import { ActivityFeedListHeader } from "./list-header";
import { ActivityFeedListItems } from "./list-items";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { useWindowSize } from "react-use";
import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";

export function ActivityFeedList({
  className,
}: {
  className?: React.ComponentProps<"div">["className"];
}) {
  const { width } = useWindowSize();

  const [activityFeedState, setActivityFeedState] =
    useAtom(activtyFeedStateAtom);

  const {
    searchValue,
    page,
    orderBy,
    status,
    featureRequestsSelected,
    bugReportsSelected,
    generalFeedbackSelected,
    commentsSelected,
  } = activityFeedState;

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
    query: { data, isPending, isError },
  } = useActivityFeed({
    enabled: true,
    page,
    pageSize: 20,
    orderBy,
    status,
    categories,
    excludeComments,
    excludeFeedback,
    searchValue,
  });

  const activeData = data;
  const items = activeData?.items;
  const totalPages = activeData?.totalPages ?? 1;
  const currentPage = activeData?.currentPage ?? 1;
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
      setActivityFeedState((prev) => ({
        ...prev,
        page: newPage,
      }));
      window.scrollTo(0, 0); // Scroll to top when page changes
    }
  };

  return (
    <>
      <div className={cn("", className)}>
        <div className="mt-2 mb-4 grid grid-cols-4 gap-2 sm:gap-3">
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
                "border-border hover:border-primary flex cursor-pointer flex-col justify-between gap-0 rounded-md p-2 shadow-xs sm:p-3",
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
                  setActivityFeedState((prev) => ({
                    ...prev,
                    page: 1,
                    featureRequestsSelected: !prev.featureRequestsSelected,
                  }));
                } else if (stat.title === "Bug reports") {
                  setActivityFeedState((prev) => ({
                    ...prev,
                    page: 1,
                    bugReportsSelected: !prev.bugReportsSelected,
                  }));
                } else if (stat.title === "General feedback") {
                  setActivityFeedState((prev) => ({
                    ...prev,
                    page: 1,
                    generalFeedbackSelected: !prev.generalFeedbackSelected,
                  }));
                } else if (stat.title === "Comments") {
                  setActivityFeedState((prev) => ({
                    ...prev,
                    page: 1,
                    commentsSelected: !prev.commentsSelected,
                  }));
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
                    {width < 640
                      ? `(${stat.newCount})`
                      : `(${stat.newCount} new)`}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="border-border overflow-hidden rounded-lg border shadow-xs">
          <ActivityFeedListHeader className="bg-background border-border border-b py-2 pr-3 pl-4" />

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
