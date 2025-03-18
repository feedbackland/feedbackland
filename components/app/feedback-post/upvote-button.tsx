"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFeedbackPost } from "@/hooks/useFeedbackPost";

export function UpvoteButton({
  ...props
}: {
  postId: string;
  upvoteCount: string;
  hasUserUpvote: boolean;
}) {
  const { postId } = props;
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const feedbackPost = useFeedbackPost({ postId });

  const upvote = useMutation(
    trpc.upvoteFeedbackPost.mutationOptions({
      onSettled: async () => {
        return await queryClient.invalidateQueries({
          queryKey: feedbackPost.queryKey,
        });
      },
    }),
  );

  const handleUpvote = () => {
    if (session && !upvote.isPending) {
      upvote.mutate({
        feedbackPostId: postId,
      });
    } else {
      console.log("not logged in");
    }
  };

  let hasUserUpvote =
    feedbackPost?.query?.data?.hasUserUpvote !== undefined
      ? feedbackPost?.query?.data?.hasUserUpvote
      : props.hasUserUpvote;

  let upvoteCount = parseInt(
    feedbackPost?.query?.data?.upvotes || props.upvoteCount,
    10,
  );

  if (upvote.isPending) {
    hasUserUpvote = !hasUserUpvote;
    upvoteCount = hasUserUpvote ? upvoteCount + 1 : upvoteCount - 1;
  }

  return (
    <Button
      variant={hasUserUpvote ? "default" : "secondary"}
      size="sm"
      className="h-[26px] px-2.5 py-1 [&>span]:gap-1"
      onClick={handleUpvote}
    >
      <ArrowBigUp
        className="!size-[1.1rem]"
        strokeWidth={1.25}
        fill={hasUserUpvote ? "white" : "none"}
      />
      <span className="text-xs">{upvoteCount}</span>
    </Button>
  );
}
