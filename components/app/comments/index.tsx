"use client";

import { Spinner } from "@/components/ui/spinner";
import { useComments } from "@/hooks/use-comments";
import { Comment } from "@/components/app/comment";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

export function Comments({
  postId,
  className,
}: {
  postId: string;
  className?: React.ComponentProps<"div">["className"];
}) {
  const { ref } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

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

  return (
    <div className={cn("", className)}>
      {/* {isPending && (
        <div className="mt-10 flex flex-col items-center justify-center space-y-2">
          <Spinner size="small" />
          <span className="text-sm">Loading comments...</span>
        </div>
      )}

      {isError && (
        <div className="py-4 text-center text-red-500">Error loading posts</div>
      )} */}

      {/* {!!(!isPending && !isError && comments.length === 0) && (
        <div className="text-muted-foreground py-4 text-center">
          No posts found
        </div>
      )} */}

      {!!(!isPending && !isError && comments.length > 0) && (
        <div className="space-y-5">
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              postId={postId}
              commentId={comment.id}
              authorId={comment.authorId}
              authorName={comment.authorName}
              authorPhotoURL={comment.authorPhotoURL}
              content={comment.content}
              createdAt={comment.createdAt}
              upvoteCount={comment.upvotes}
              hasUserUpvote={comment.hasUserUpvote}
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
