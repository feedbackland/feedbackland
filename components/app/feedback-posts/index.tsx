"use client";

import { useEffect, useRef } from "react";
import { useFeedbackPosts } from "@/hooks/useFeedbackPosts";
import { FeedbackPost } from "@/components/app/feedback-post";
import { Spinner } from "@/components/ui/spinner";

export function FeedbackPosts() {
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

  const posts = data?.pages.flatMap((page) => page.feedbackPosts) || [];

  console.log("posts", posts);

  return (
    <div className="mt-12">
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
              authorName={post.authorName || "unknown"}
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
