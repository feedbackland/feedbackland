"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/providers/trpc-client";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowBigUp } from "lucide-react";
import { Session, useAuth } from "@/hooks/use-auth";
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

  const isUpvotePending = upvote.isPending;

  let hasUserUpvote =
    comment?.query?.data?.hasUserUpvote !== undefined
      ? comment?.query?.data?.hasUserUpvote
      : props.hasUserUpvote;

  let upvoteCount = parseInt(
    comment?.query?.data?.upvotes || props.upvoteCount,
    10,
  );

  // optimistic update
  if (upvote.isPending) {
    hasUserUpvote = !hasUserUpvote;
    upvoteCount = hasUserUpvote ? upvoteCount + 1 : upvoteCount - 1;
  }

  const handleUpvote = ({
    session,
    allowUndo = true,
  }: {
    session: Session | null;
    allowUndo?: boolean;
  }) => {
    if (isUpvotePending) {
      return;
    }

    if (session) {
      upvote.mutate({
        commentId,
        allowUndo,
      });
    } else {
      setShowSignUpInDialog(true);
    }
  };

  return (
    <>
      <Button
        variant={hasUserUpvote ? "link" : "link"}
        size="sm"
        className={cn(
          "text-muted-foreground hover:text-primary -ml-1.5 flex h-fit items-center px-1 py-1 pr-2 hover:no-underline [&>span]:gap-1",
          hasUserUpvote && "text-primary",
          className,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleUpvote({ session });
        }}
      >
        <ArrowBigUp
          className={cn("size-5!")}
          strokeWidth={1.5}
          fill={hasUserUpvote ? "var(--primary)" : "none"}
        />
        <span className="text-xs">{upvoteCount}</span>
      </Button>

      <SignUpInDialog
        open={showSignUpInDialog}
        initialSelectedMethod="sign-in"
        onClose={() => setShowSignUpInDialog(false)}
        onSuccess={(newSession) => {
          setShowSignUpInDialog(false);
          handleUpvote({ session: newSession, allowUndo: false });
        }}
      />
    </>
  );
}
