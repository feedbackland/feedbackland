"use client";

import { Spinner } from "@/components/ui/spinner";
import { useComments } from "@/hooks/use-comments";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { CommentWrapper } from "../comment/wrapper";
import { Error } from "@/components/ui/error";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { MessageSquareDashed } from "lucide-react";
import { CommentsLoading } from "./loading";

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
        <Empty className="md:py-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareDashed className="size-5!" />
            </EmptyMedia>
            <EmptyTitle>No comments yet</EmptyTitle>
            <EmptyDescription>
              Kick things off. Leave a comment!
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!!(!isPending && !isError && comments.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-4">
            Comments <span className="text-muted-foreground">({parentComments.length})</span>
          </h3>
          <div className="divide-y divide-border">
            {parentComments.map((comment) => {
              const childComments = comments.filter(
                (i) => i.parentCommentId === comment.id,
              );

              return (
                <div key={comment.id} className="py-4 first:pt-0 last:pb-0">
                  <CommentWrapper
                    comment={comment}
                    childComments={childComments}
                    className=""
                  />
                </div>
              );
            })}
          </div>

          {isFetchingNextPage && (
            <div className="flex items-center justify-start py-5">
              <Spinner />
              <span className="ml-2 text-sm">Loading more...</span>
            </div>
          )}

          <div ref={ref} className="h-1 w-full" />
        </div>
      )}
    </div>
  );
}
