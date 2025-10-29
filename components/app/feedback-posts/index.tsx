"use client";

import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { FeedbackPostCompact } from "@/components/app/feedback-post/compact";
import { Spinner } from "@/components/ui/spinner";
import { FeedbackPostsSearchInput } from "./search-input";
import { useInView } from "react-intersection-observer";
import { FeedbackPostsLoading } from "./loading";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";
import { feedbackPostsStateAtom, previousPathnameAtom } from "@/lib/atoms";
import { useAtom, useAtomValue } from "jotai";
import { useInIframe } from "@/hooks/use-in-iframe";
import { isUuidV4 } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useWindowSize } from "react-use";
import { FeedbackPostsEmpty } from "./empty";

function isInViewport(el: Element) {
  if (!(el instanceof HTMLElement)) return false;

  const rect = el.getBoundingClientRect();

  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.left <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function FeedbackPosts() {
  const { width } = useWindowSize();
  const [isScrolledIntoView, setIsScrolledIntoView] = useState(false);
  const [feedbackPostsState, setFeedbackPostsState] = useAtom(
    feedbackPostsStateAtom,
  );
  const inIframe = useInIframe();
  const previousPathname = useAtomValue(previousPathnameAtom);
  const previousPathnameLastSegment = previousPathname?.split("/").pop();
  const postIdToScrollIntoView = isUuidV4(previousPathnameLastSegment || "")
    ? previousPathnameLastSegment
    : null;

  const { searchValue, orderBy, status } = feedbackPostsState;

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    query: {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending,
      isError,
    },
  } = useFeedbackPosts({
    enabled: true,
    orderBy,
    status,
    searchValue,
  });

  const posts = data?.pages.flatMap((page) => page.feedbackPosts) || [];

  const isPlatformEmpty =
    !isPending &&
    !isSearchActive &&
    !isError &&
    status === null &&
    Array.isArray(posts) &&
    posts?.length === 0;

  const isSearchEmpty =
    !isPending &&
    isSearchActive &&
    !isError &&
    Array.isArray(posts) &&
    posts?.length === 0;

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  useEffect(() => {
    if (
      inIframe &&
      postIdToScrollIntoView &&
      !isScrolledIntoView &&
      !isPending
    ) {
      setIsScrolledIntoView(true);

      const element = document.querySelector(
        `[data-post-id="${postIdToScrollIntoView}"]`,
      );

      if (element) {
        setTimeout(() => {
          if (!isInViewport(element)) {
            element.scrollIntoView({ behavior: "instant", block: "center" });
          }
        }, 20);
      }
    }
  }, [inIframe, postIdToScrollIntoView, isScrolledIntoView, isPending]);

  return (
    <div className="">
      {!!((!isPending && !isPlatformEmpty) || isSearchActive) &&
        width < 768 && (
          <div className="relative mb-1.5 flex h-[40px] items-center gap-4">
            <SortingFilteringDropdown
              orderBy={orderBy}
              status={status}
              onChange={({ orderBy, status }) => {
                setFeedbackPostsState((prev) => ({
                  ...prev,
                  orderBy,
                  status,
                }));
              }}
            />

            <FeedbackPostsSearchInput />
          </div>
        )}

      {isPending && <FeedbackPostsLoading />}

      {isError && (
        <div className="text-destructive py-4 text-center">
          Error loading posts
        </div>
      )}

      {isPlatformEmpty && <FeedbackPostsEmpty />}

      {isSearchEmpty && (
        <div className="text-muted-foreground py-5 text-center text-sm font-normal">
          No feedback found that matches your search
        </div>
      )}

      {!isPending &&
        !isError &&
        !isPlatformEmpty &&
        !isSearchEmpty &&
        status !== null &&
        Array.isArray(posts) &&
        posts.length === 0 && (
          <div className="text-muted-foreground py-5 text-center text-sm font-normal">
            No feedback found that is marked as {status}
          </div>
        )}

      {!!(
        !isPending &&
        !isError &&
        Array.isArray(posts) &&
        posts.length > 0
      ) && (
        <div className="space-y-9">
          {posts.map((post) => (
            <FeedbackPostCompact
              key={post.id}
              postId={post.id}
              authorId={post.authorId}
              title={post.title}
              description={post.description}
              status={post.status}
              createdAt={post.createdAt}
              category={post.category}
              upvoteCount={post.upvotes}
              commentCount={String(post?.commentCount)}
              hasUserUpvote={post.hasUserUpvote}
            />
          ))}

          {isFetchingNextPage && (
            <div className="flex items-center justify-start py-5">
              <Spinner />
              <span className="ml-2 text-sm">Loading more...</span>
            </div>
          )}

          <div ref={ref} className="h-1 w-full" />
        </div>
      )}
    </div>
  );
}
