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
import { OrderBy } from "@/lib/typings";
import { useInView } from "react-intersection-observer";

function convertToString(value: string | number | bigint | null): string {
  if (value === null) {
    return ""; // or 'null' if you prefer to represent null as a string
  }
  return value.toString();
}

export function FeedbackPosts() {
  const [searchValue, setSearchValue] = useState("");
  const [orderBy, setOrderBy] = useState<OrderBy>("newest");

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
          onValueChange={(value) => setOrderBy(value as OrderBy)}
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

      {isPending && (
        <div className="mt-10 flex flex-col items-center justify-center space-y-2">
          <Spinner size="small" />
          <span className="text-sm">
            {isSearchActive ? "Searching..." : "Loading feedback..."}
          </span>
        </div>
      )}

      {isError && (
        <div className="py-4 text-center text-red-500">Error loading posts</div>
      )}

      {!!(!isPending && !isError && posts.length === 0) && (
        <div className="text-muted-foreground py-4 text-center">
          No posts found
        </div>
      )}

      {!!(!isPending && !isError && posts.length > 0) && (
        <div className="space-y-4">
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
