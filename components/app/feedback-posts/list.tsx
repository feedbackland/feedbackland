"use client";

import { useEffect, useRef } from "react";
import { useFeedbackPosts } from "@/hooks/useFeedbackPosts";
import DOMPurify from "dompurify";
import parse from "html-react-parser";

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
    <div className="mt-16 space-y-6">
      {posts.length === 0 ? (
        <p className="text-gray-500">No posts found</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="">
              <h3 className="text-xl font-semibold">{post.title}</h3>
              <div className="mt-1 text-sm text-gray-500">
                By {post.authorId} • {post.createdAt.toISOString()}
              </div>
              <div className="mt-2">
                {parse(DOMPurify.sanitize(post.description))}
              </div>
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
