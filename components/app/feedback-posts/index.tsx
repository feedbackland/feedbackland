"use client";

import { useState } from "react";
import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { FeedbackPostCompact } from "@/components/app/feedback-post/compact";
import { Spinner } from "@/components/ui/spinner";
import { FeedbackPostsSearchInput } from "./search-input";
import { FeedbackOrderBy, FeedbackStatus } from "@/lib/typings";
import { useInView } from "react-intersection-observer";
import { FeedbackPostsLoading } from "./loading";
import { SortingFilteringDropdown } from "@/components/ui/sorting-filtering-dropdown";

export function FeedbackPosts() {
  const [searchValue, setSearchValue] = useState("");
  const [orderBy, setOrderBy] = useState<FeedbackOrderBy>("newest");
  const [status, setStatus] = useState<FeedbackStatus>(null);

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

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  return (
    <div className="mt-10">
      {!isPlatformEmpty && (
        <div className="relative mb-3 flex h-[40px] items-center justify-between gap-2">
          <SortingFilteringDropdown
            orderBy={orderBy}
            status={status}
            onChange={({ orderBy, status }) => {
              setOrderBy(orderBy);
              setStatus(status);
            }}
          />

          <FeedbackPostsSearchInput onDebouncedChange={handleSearch} />
        </div>
      )}

      {isPending && <FeedbackPostsLoading />}

      {isError && (
        <div className="py-4 text-center text-red-500">Error loading posts</div>
      )}

      {isPlatformEmpty && (
        <div className="text-muted-foreground space-y-1 py-5 text-center">
          <div className="text-base font-semibold">
            Be the first to share feedback
          </div>
          <span className="text-sm">
            Have a feature request, a suggestion, or spotted a bug? Let us know!
          </span>
        </div>
      )}

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
              <Spinner size="small" />
              <span className="ml-2 text-sm">Loading more...</span>
            </div>
          )}

          <div ref={ref} className="h-1 w-full" />
        </div>
      )}
    </div>
  );
}
