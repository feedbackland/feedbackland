"use client";

import { useState } from "react";
import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { FeedbackPostCompact } from "@/components/app/feedback-post/compact";
import { Spinner } from "@/components/ui/spinner";
import { FeedbackPostsSearchInput } from "./search-input";
import { useSearchFeedbackPosts } from "@/hooks/use-search-feedback-posts";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeedbackOrderBy } from "@/lib/typings";
import { useInView } from "react-intersection-observer";
import { FeedbackPostsLoading } from "./loading";

function convertToString(value: string | number | bigint | null): string {
  if (value === null) {
    return "";
  }

  return value.toString();
}

export function FeedbackPosts() {
  const [searchValue, setSearchValue] = useState("");
  const [orderBy, setOrderBy] = useState<FeedbackOrderBy>("newest");

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
  } = useFeedbackPosts({ enabled: !isSearchActive, orderBy });

  const {
    query: {
      data: searchData,
      isPending: isSearchPending,
      isError: isSearchError,
    },
  } = useSearchFeedbackPosts({
    searchValue,
    enabled: isSearchActive,
  });

  const posts =
    (isSearchActive
      ? searchData
      : postsData?.pages.flatMap((page) => page.feedbackPosts)) || [];
  const isPending = isSearchActive ? isSearchPending : isPostsPending;
  const isError = isSearchActive ? isSearchError : isPostsError;

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
      <div className="relative mb-5 flex items-center justify-between">
        <Select
          defaultValue="newest"
          value={orderBy}
          onValueChange={(value) => setOrderBy(value as FeedbackOrderBy)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="upvotes">Most upvoted</SelectItem>
              <SelectItem value="comments">Most commented</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FeedbackPostsSearchInput onDebouncedChange={handleSearch} />
      </div>

      {isPending && <FeedbackPostsLoading />}

      {/* {isPending && (
        <div className="mt-10 flex flex-col items-center justify-center space-y-2">
          <Spinner size="small" />
          <span className="text-sm">
            {isSearchActive ? "Searching..." : "Loading feedback..."}
          </span>
        </div>
      )} */}

      {isError && (
        <div className="py-4 text-center text-red-500">Error loading posts</div>
      )}

      {!!(!isPending && !isError && posts.length === 0) && (
        <div className="text-muted-foreground space-y-1 py-6 text-center">
          {!isSearchActive ? (
            <>
              <div className="text-base font-semibold">
                Be the first to share feedback
              </div>
              <span className="text-sm">
                Have a feature request, a suggestion, or spotted a bug? Let us
                know!
              </span>
            </>
          ) : (
            <div className="text-base font-semibold">
              No feedback matched your search
            </div>
          )}
        </div>
      )}

      {!!(!isPending && !isError && posts.length > 0) && (
        <div className="space-y-8">
          {posts.map((post) => (
            <FeedbackPostCompact
              key={post.id}
              postId={post.id}
              title={post.title}
              description={post.description}
              createdAt={post.createdAt}
              category={post.category}
              upvoteCount={post.upvotes}
              commentCount={convertToString(post?.commentCount)}
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
