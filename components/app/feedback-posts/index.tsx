"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedbackPosts } from "@/hooks/useFeedbackPosts";
import { FeedbackPost } from "@/components/app/feedback-post";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput } from "@/components/ui/search-input";
import { useSearchFeedbackPosts } from "@/hooks/useSearchFeedbackPosts";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderBy } from "@/lib/typings";

export function FeedbackPosts() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [searchValue, setSearchValue] = useState("");
  const [orderBy, setOrderBy] = useState<OrderBy>("newest");

  const isSearching = !!(searchValue?.length > 0);

  console.log("FeedbackPosts orderBy", orderBy);

  const {
    query: {
      data: postsData,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending: isPostsPending,
      isError: isPostsError,
    },
  } = useFeedbackPosts({ enabled: !isSearching, orderBy });

  const {
    query: {
      data: searchData,
      isPending: isSearchPending,
      isError: isSearchError,
    },
  } = useSearchFeedbackPosts({
    searchValue,
    enabled: isSearching,
  });

  const posts =
    (isSearching
      ? searchData
      : postsData?.pages.flatMap((page) => page.feedbackPosts)) || [];
  const isPending = isSearching ? isSearchPending : isPostsPending;
  const isError = isSearching ? isSearchError : isPostsError;

  useEffect(() => {
    if (loadMoreRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });

      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isPending) {
    return (
      <div className="mt-10 flex flex-col items-center justify-center space-y-2">
        <Spinner size="small" />
        <span className="text-sm">Loading posts...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-center text-red-500">Error loading posts</div>
    );
  }

  const handleSearch = (value: string) => {
    setSearchValue(value || "");
  };

  return (
    <div className="mt-12 space-y-5">
      <div className="relative flex items-center justify-between">
        <SearchInput onDebouncedChange={handleSearch} delay={500} />
        <Select
          value={orderBy}
          onValueChange={(value) => {
            setOrderBy(value as OrderBy);
          }}
        >
          <SelectTrigger className="pl-1 pr-2 text-sm">
            <span className="ml-1.5 text-muted-foreground">Sort by:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="upvotes">Most upvotes</SelectItem>
              <SelectItem value="comments">Most comments</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts found</p>
      ) : (
        <div className="space-y-10">
          {posts.map((post) => (
            <FeedbackPost
              key={post.id}
              id={post.id}
              title={post.title}
              description={post.description}
              category={post.category || "other"}
              createdAt={post.createdAt}
              upvoteCount={post.upvotes}
              hasUserUpvote={post.hasUserUpvote}
            />
          ))}

          {isFetchingNextPage && (
            <div className="flex justify-start">
              <Spinner size="small" />
            </div>
          )}

          <div ref={loadMoreRef} className="h-1 w-full" />
        </div>
      )}
    </div>
  );
}
