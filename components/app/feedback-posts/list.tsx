"use client";

import { useEffect, useRef } from "react";
import { useFeedbackPosts } from "@/hooks/useFeedbackPosts";
import { FeedbackPost } from "./post";

export function FeedbackPostsList() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    query: {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoading,
      isError,
    },
  } = useFeedbackPosts();

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
    <div className="mt-12">
      {posts.length === 0 ? (
        <p className="text-gray-500">No posts found</p>
      ) : (
        <div className="space-y-10">
          {posts.map((post) => (
            <FeedbackPost
              key={post.id}
              title={post.title}
              description={post.description}
              category={post.category || "other"}
              authorName={post.authorName || "unknown"}
              createdAt={post.createdAt}
            />
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
