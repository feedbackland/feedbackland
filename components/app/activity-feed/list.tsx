"use client";

import { FeedbackCategories } from "@/lib/typings";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityFeedLoading } from "./loading";
import { ActivityFeedListPagination } from "./list-pagination";
import { ActivityFeedListHeader } from "./list-header";
import { ActivityFeedListItems } from "./list-items";
import { cn } from "@/lib/utils";
import { useActivityFeedMetaData } from "@/hooks/use-activity-feed-meta-data";
import { useWindowSize } from "react-use";
import { useAtom } from "jotai";
import { activtyFeedStateAtom } from "@/lib/atoms";
import {
  BadgeAlert,
  Lightbulb,
  MessageSquare,
  NotebookText,
} from "lucide-react";

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
    ideasSelected,
    issuesSelected,
    generalFeedbackSelected,
    commentsSelected,
  } = activityFeedState;

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: { data: metaData },
  } = useActivityFeedMetaData({ enabled: true });

  let categories = null;

  if (ideasSelected) {
    categories = [...(categories || []), "idea"];
  }

  if (issuesSelected) {
    categories = [...(categories || []), "issue"];
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
              title: "Ideas",
              totalCount: metaData?.totalIdeasPostCount || 0,
              newCount: metaData?.unseenIdeasPostCount || 0,
            },
            {
              title: "Issues",
              totalCount: metaData?.totalIssuesPostCount || 0,
              newCount: metaData?.unseenIssuesPostCount || 0,
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
            <div
              key={index}
              className={cn(
                "border-border hover:border-primary flex cursor-pointer flex-col justify-between gap-1 rounded-md border p-2 shadow-xs hover:ring-1 hover:ring-black hover:ring-inset sm:p-3",
                stat.title === "Ideas" &&
                  ideasSelected &&
                  "border-primary bg-muted/50 ring-1 ring-black ring-inset",
                stat.title === "Issues" &&
                  issuesSelected &&
                  "border-primary bg-muted/50 ring-1 ring-black ring-inset",
                stat.title === "General feedback" &&
                  generalFeedbackSelected &&
                  "border-primary bg-muted/50 ring-1 ring-black ring-inset",
                stat.title === "Comments" &&
                  commentsSelected &&
                  "border-primary bg-muted/50 ring-1 ring-black ring-inset",
              )}
              onClick={() => {
                if (stat.title === "Ideas") {
                  setActivityFeedState((prev) => ({
                    ...prev,
                    page: 1,
                    ideasSelected: !prev.ideasSelected,
                  }));
                } else if (stat.title === "Issues") {
                  setActivityFeedState((prev) => ({
                    ...prev,
                    page: 1,
                    issuesSelected: !prev.issuesSelected,
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
              <div className="p-0 pb-1 text-xs font-medium sm:text-sm">
                {stat.title}
              </div>
              <div className="flex items-center gap-2">
                {stat.title === "Ideas" && <Lightbulb className="size-4.5!" />}
                {stat.title === "Issues" && (
                  <BadgeAlert className="size-4.5!" />
                )}
                {stat.title === "General feedback" && (
                  <NotebookText className="size-4.5!" />
                )}
                {stat.title === "Comments" && (
                  <MessageSquare className="size-4.5!" />
                )}
                <div className="flex items-baseline gap-1.5 p-0">
                  <span className="text-xl font-semibold">
                    {stat.totalCount}
                  </span>
                  {stat.newCount !== undefined && stat.newCount > 0 && (
                    <span className="text-xs font-normal">
                      {width < 640
                        ? `(${stat.newCount})`
                        : `(${stat.newCount} new)`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-border overflow-hidden rounded-lg border shadow-xs">
          <ActivityFeedListHeader className="border-border bg-background border-b pr-2 pl-3" />

          <div className="flex flex-col items-stretch">
            {showItems && <ActivityFeedListItems items={items} />}

            {isPending && <ActivityFeedLoading />}

            {!isPending && isError && (
              <div className="text-destructive py-5 text-center text-sm">
                Error loading activity feed
              </div>
            )}

            {isPlatformEmpty && (
              <div className="text-muted-foreground space-y-1 py-5 text-center text-sm">
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
