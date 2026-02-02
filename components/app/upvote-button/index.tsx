"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useFeedbackPost } from "@/hooks/use-feedback-post";
import { SignUpInDialog } from "@/components/app/sign-up-in/dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Session } from "@/hooks/use-auth";

export function UpvoteButton({
  postId,
  className,
  ...props
}: {
  postId: string;
  upvoteCount: string;
  hasUserUpvote: boolean;
  className?: React.ComponentProps<"div">["className"];
}) {
  const { session } = useAuth();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    query: { data },
  } = useFeedbackPost({ postId });

  const [showSignUpInDialog, setShowSignUpInDialog] = useState(false);

  const upvote = useMutation(
    trpc.upvoteFeedbackPost.mutationOptions({
      onSettled: async () => {
        return await queryClient.invalidateQueries({
          queryKey: trpc.getFeedbackPost.queryKey({ postId }),
        });
      },
    }),
  );

  const isUpvotePending = upvote.isPending;

  let hasUserUpvote =
    data?.hasUserUpvote !== undefined
      ? data?.hasUserUpvote
      : props.hasUserUpvote;

  let upvoteCount = parseInt(data?.upvotes || props.upvoteCount, 10);

  // optimistic update
  if (isUpvotePending) {
    hasUserUpvote = !hasUserUpvote;
    upvoteCount = hasUserUpvote ? upvoteCount + 1 : upvoteCount - 1;
  }

  const handleUpvote = ({
    session,
    allowUndo = true,
  }: {
    session: Session;
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
        variant={hasUserUpvote ? "default" : "outline"}
        size="sm"
        className={cn(
          "flex h-[25px] items-center px-2 py-0 [&>span]:gap-1",
          className,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleUpvote({ session });
        }}
      >
        <ArrowBigUp
          className="size-[0.85rem]!"
          fill={hasUserUpvote ? "var(--background)" : "none"}
        />
        <span className="text-xs">{upvoteCount}</span>
      </Button>

      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={(newSession) => {
          setShowSignUpInDialog(false);

          if (newSession) {
            handleUpvote({ session: newSession, allowUndo: false });
          }
        }}
      />
    </>
  );
}
