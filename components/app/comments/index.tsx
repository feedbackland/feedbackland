"use client";

import { Spinner } from "@/components/ui/spinner";
import { useComments } from "@/hooks/use-comments";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { CommentWrapper } from "../comment/wrapper";
import { CommentsLoading } from "./loading";
import { Error } from "@/components/ui/error";

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

  const parentComments = comments.filter((comment) => !comment.parentCommentId);

  return (
    <div className={cn("", className)}>
      {isPending && <CommentsLoading />}

      {isError && <Error title="Error loading comments" />}

      {!!(!isPending && !isError && comments.length === 0) && (
        <div className="text-muted-foreground py-1 text-center text-sm">
          Be the first to comment
        </div>
      )}

      {!!(!isPending && !isError && comments.length > 0) && (
        <div className="space-y-4">
          {parentComments.map((comment) => {
            const childComments = comments.filter(
              (i) => i.parentCommentId === comment.id,
            );

            return (
              <CommentWrapper
                key={comment.id}
                comment={comment}
                childComments={childComments}
                className=""
              />
            );
          })}

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
