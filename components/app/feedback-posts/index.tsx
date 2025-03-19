"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedbackPosts } from "@/hooks/use-feedback-posts";
import { FeedbackPost } from "@/components/app/feedback-post";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput } from "./search-input";
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
import { Separator } from "@/components/ui/separator";

export function FeedbackPosts() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (loadMoreRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });

      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef?.current?.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  return (
    <div className="mt-10">
      <div className="relative flex flex-row-reverse items-center justify-between">
        <SearchInput onDebouncedChange={handleSearch} />
        <Select
          value={orderBy}
          onValueChange={(value) => setOrderBy(value as OrderBy)}
        >
          <SelectTrigger className="gap-1 border-none p-0 text-sm shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              <SelectItem value="newest">New</SelectItem>
              <SelectItem value="upvotes">Upvotes</SelectItem>
              <SelectItem value="comments">Comments</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
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
        <>
          {posts.map((post) => (
            <div key={post.id}>
              <FeedbackPost
                id={post.id}
                title={post.title}
                description={post.description}
                category={post.category || "other"}
                createdAt={post.createdAt}
                upvoteCount={post.upvotes}
                hasUserUpvote={post.hasUserUpvote}
                className="py-5"
              />
              <Separator className="bg-border/80" />
            </div>
          ))}

          {isFetchingNextPage && (
            <div className="flex items-center justify-start py-5">
              <Spinner size="small" />
              <span className="ml-2 text-sm">Loading more...</span>
            </div>
          )}

          <div ref={loadMoreRef} className="h-1 w-full" />
        </>
      )}
    </div>
  );
}
