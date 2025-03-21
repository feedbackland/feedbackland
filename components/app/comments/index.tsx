"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useComments } from "@/hooks/use-comments";
import { Comment } from "@/components/app/comment";

export function Comments({ postId }: { postId: string }) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    query: {
      data,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isPending,
      isError,
    },
  } = useComments({ postId });

  const comments = data?.pages.flatMap((page) => page.comments) || [];

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

  return (
    <div className="mt-10">
      {isPending && (
        <div className="mt-10 flex flex-col items-center justify-center space-y-2">
          <Spinner size="small" />
          <span className="text-sm">Loading comments...</span>
        </div>
      )}

      {isError && (
        <div className="py-4 text-center text-red-500">Error loading posts</div>
      )}

      {!!(!isPending && !isError && comments.length === 0) && (
        <div className="text-muted-foreground py-4 text-center">
          No posts found
        </div>
      )}

      {!!(!isPending && !isError && comments.length > 0) && (
        <div className="space-y-5">
          {comments.map((comment) => (
            <div key={comment.id} className="">
              <Comment
                postId={postId}
                commentId={comment.id}
                authorId={comment.authorId}
                authorName={comment.authorName || ""}
                content={comment.content}
                createdAt={comment.createdAt}
                upvoteCount={comment.upvotes}
                hasUserUpvote={comment.hasUserUpvote}
              />
            </div>
          ))}

          {isFetchingNextPage && (
            <div className="flex items-center justify-start py-5">
              <Spinner size="small" />
              <span className="ml-2 text-sm">Loading more...</span>
            </div>
          )}

          <div ref={loadMoreRef} className="h-1 w-full" />
        </div>
      )}
    </div>
  );
}
