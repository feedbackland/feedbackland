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

  const isSearchActive = !!(searchValue?.length > 0);

  const {
    queryKey,
    query: {
      data: postsData,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending: isPostsPending,
      isError: isPostsError,
    },
  } = useFeedbackPosts({ enabled: !isSearchActive, orderBy });

  console.log(queryKey);

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
    setSearchValue(value || "");
  };

  const Pending = (): React.ReactNode => {
    if (isPending) {
      return (
        <div className="mt-10 flex flex-col items-center justify-center space-y-2">
          <Spinner size="small" />
          <span className="text-sm">Loading posts...</span>
        </div>
      );
    }

    return null;
  };

  const Error = (): React.ReactNode => {
    if (isError) {
      return (
        <div className="py-4 text-center text-red-500">Error loading posts</div>
      );
    }

    return null;
  };

  const TopBar = (): React.ReactNode => {
    return (
      <div className="relative flex items-center justify-between">
        <SearchInput onDebouncedChange={handleSearch} delay={500} />
        <Select
          value={orderBy}
          onValueChange={(value) => setOrderBy(value as OrderBy)}
        >
          <SelectTrigger className="flex items-center pl-1 pr-2 text-sm shadow-sm">
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
    );
  };

  const NoPosts = (): React.ReactNode => {
    if (!isPending && !isError && posts.length === 0) {
      return <p className="text-muted-foreground">No posts found</p>;
    }
    return null;
  };

  const Posts = (): React.ReactNode => {
    if (!isPending && !isError && posts.length > 0) {
      return (
        <div className="space-y-9">
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
      );
    }

    return null;
  };

  return (
    <div className="mt-12 space-y-5">
      <TopBar />
      <Pending />
      <Error />
      <NoPosts />
      <Posts />
    </div>
  );
}
