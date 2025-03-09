"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/providers/trpc-client";

export function PostList() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // const {
  //   data,
  //   fetchNextPage,
  //   hasNextPage,
  //   isFetchingNextPage,
  //   isLoading,
  //   isError,
  // } = trpc.posts.infinitePosts.useInfiniteQuery(
  //   {
  //     limit: 10,
  //   },
  //   {
  //     getNextPageParam: (lastPage) => lastPage.nextCursor,
  //   },
  // );

  // return useInfiniteQuery<PaginatedResponse, Error>({
  //   queryKey: ['posts', 'infinite'],
  //   queryFn: fetchPosts,
  //   initialPageParam: null,
  //   getNextPageParam: (lastPage) =>
  //     lastPage.pagination.hasNextPage ? lastPage.pagination.nextCursor : undefined,
  // });

  const trpc = useTRPC();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery(
    trpc.getFeedbackPosts.infiniteQueryOptions(
      { limit: 10, cursor: null },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );

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

  if (isLoading) {
    return <div className="py-4 text-center">Loading posts...</div>;
  }

  if (isError) {
    return (
      <div className="py-4 text-center text-red-500">Error loading posts</div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.feedbackPosts) || [];

  return (
    <div className="space-y-6">
      <h2 className="mb-4 text-2xl font-semibold">Posts</h2>

      {posts.length === 0 ? (
        <p className="text-gray-500">No posts found</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow"
            >
              <h3 className="text-xl font-semibold">{post.title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                By {post.authorId} • {post.createdAt.toISOString()}
              </p>
              <p className="mt-2">{post.description}</p>
            </div>
          ))}

          <div
            ref={loadMoreRef}
            className="flex h-10 items-center justify-center"
          >
            {isFetchingNextPage
              ? "Loading more..."
              : hasNextPage
                ? "Scroll for more"
                : "No more posts"}
          </div>
        </div>
      )}
    </div>
  );
}
