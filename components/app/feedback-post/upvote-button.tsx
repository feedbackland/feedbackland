"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { User } from "firebase/auth";

export function FeedbackPostUpvoteButton({
  postId,
  variant,
  className,
  ...props
}: {
  postId: string;
  variant:
    | "link"
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost";
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const feedbackPost = useFeedbackPost({ postId });

  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);

  const upvote = useMutation(
    trpc.upvoteFeedbackPost.mutationOptions({
      onSettled: async () => {
        return await queryClient.invalidateQueries({
          queryKey: feedbackPost.queryKey,
        });
      },
    }),
  );

  const isUpvotePending = upvote.isPending;

  let hasUserUpvote =
    feedbackPost?.query?.data?.hasUserUpvote !== undefined
      ? feedbackPost?.query?.data?.hasUserUpvote
      : props.hasUserUpvote;

  let upvoteCount = parseInt(
    feedbackPost?.query?.data?.upvotes || props.upvoteCount,
    10,
  );

  // optimistic update
  if (isUpvotePending) {
    hasUserUpvote = !hasUserUpvote;
    upvoteCount = hasUserUpvote ? upvoteCount + 1 : upvoteCount - 1;
  }

  const handleUpvote = ({
    session,
    allowUndo = true,
  }: {
    session: User | null;
    allowUndo?: boolean;
  }) => {
    if (isUpvotePending) {
      return;
    }

    if (session) {
      upvote.mutate({
        postId,
        allowUndo,
      });
    } else {
      setShowSignUpInDialog(true);
    }
  };

  return (
    <>
      <Button
        variant={hasUserUpvote ? "default" : variant}
        size="sm"
        className={cn("", className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleUpvote({ session });
        }}
      >
        <ArrowBigUp
          className="size-[1.1rem]!"
          strokeWidth={1.5}
          fill={hasUserUpvote ? "var(--background)" : "none"}
        />
        <span className="text-xs">{upvoteCount}</span>
      </Button>

      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={(session) => {
          setShowSignUpInDialog(false);
          handleUpvote({ session, allowUndo: false });
        }}
      />
    </>
  );
}
