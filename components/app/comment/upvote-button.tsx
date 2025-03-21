"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useComment } from "@/hooks/use-comment";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CommentUpvoteButton({
  commentId,
  className,
  ...props
}: {
  commentId: string;
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const comment = useComment({ commentId });

  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);

  const upvote = useMutation(
    trpc.upvoteComment.mutationOptions({
      onSettled: async () => {
        return await queryClient.invalidateQueries({
          queryKey: comment.queryKey,
        });
      },
    }),
  );

  const handleUpvote = () => {
    if (upvote.isPending) {
      return;
    }

    if (session) {
      upvote.mutate({
        commentId,
      });
    } else {
      setShowSignUpInDialog(true);
    }
  };

  let hasUserUpvote =
    comment?.query?.data?.hasUserUpvote !== undefined
      ? comment?.query?.data?.hasUserUpvote
      : props.hasUserUpvote;

  let upvoteCount = parseInt(
    comment?.query?.data?.upvotes || props.upvoteCount,
    10,
  );

  if (upvote.isPending) {
    hasUserUpvote = !hasUserUpvote;
    upvoteCount = hasUserUpvote ? upvoteCount + 1 : upvoteCount - 1;
  }

  return (
    <>
      <Button
        variant={hasUserUpvote ? "default" : "secondary"}
        size="sm"
        className={cn("", className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleUpvote();
        }}
      >
        <ArrowBigUp
          className="size-[1.1rem]!"
          strokeWidth={1.5}
          fill={hasUserUpvote ? "white" : "none"}
        />
        <span className="text-xs">{upvoteCount}</span>
      </Button>

      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={() => {
          setShowSignUpInDialog(false);
          handleUpvote();
        }}
      />
    </>
  );
}
