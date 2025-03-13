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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: feedbackPost.queryKey });
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

  const hasUserUpvote =
    feedbackPost?.query?.data?.hasUserUpvote !== undefined
      ? feedbackPost?.query?.data?.hasUserUpvote
      : props.hasUserUpvote;

  const upvoteCount = feedbackPost?.query?.data?.upvotes || props.upvoteCount;

  return (
    <Button
      variant={hasUserUpvote ? "default" : "outline"}
      size="sm"
      className=""
      onClick={handleUpvote}
    >
      <ArrowBigUp className="!size-[19px]" strokeWidth={1.25} />
      <span className="text-xs">{upvoteCount}</span>
    </Button>
  );
}
